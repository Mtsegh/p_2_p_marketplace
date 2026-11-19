import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";

/**
 * Data access for identity records. Services own business rules; this module
 * only talks to Prisma and keeps transaction handling close to the writes that
 * must be atomic.
 */
type Db = Prisma.TransactionClient | typeof prisma;

export interface SessionInput {
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { profile: true },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { profile: true },
  });
}

/**
 * Creates the account and its first refresh session atomically. A failure
 * halfway through would otherwise leave a user who cannot stay signed in.
 */
export function createUserWithSession(
  user: { email: string; passwordHash: string },
  session: Omit<SessionInput, "userId">,
) {
  return prisma.$transaction(async (tx) => {
    // Nested create: the account and its profile row exist together or not at
    // all, so no query can ever see a user without a profile.
    const createdUser = await tx.user.create({
      data: { ...user, profile: { create: {} } },
      include: { profile: true },
    });
    const createdSession = await tx.session.create({
      data: { ...session, userId: createdUser.id },
    });

    return { user: createdUser, session: createdSession };
  });
}

export function createSession(input: SessionInput, db: Db = prisma) {
  return db.session.create({ data: input });
}

export function findSessionByTokenHash(tokenHash: string) {
  return prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { profile: true } } },
  });
}

export function revokeSessionById(id: string, db: Db = prisma) {
  return db.session.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function revokeFamily(familyId: string) {
  return prisma.session.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revokes the presented session and issues its replacement in one transaction.
 * Returns null when another request already rotated it, which the caller
 * treats as a stale token rather than a security event.
 */
export function rotateSession(previousSessionId: string, next: SessionInput) {
  return prisma.$transaction(async (tx) => {
    const revoked = await tx.session.updateMany({
      where: { id: previousSessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count === 0) {
      return null;
    }

    return tx.session.create({ data: next });
  });
}

export function listActiveSessions(userId: string) {
  return prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      expiresAt: true,
    },
  });
}

export function revokeOwnedSession(userId: string, sessionId: string) {
  return prisma.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function revokeAllUserSessions(userId: string) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface CreateAuthTokenInput {
  userId: string;
  type:
    | "EMAIL_VERIFY"
    | "PASSWORD_RESET"
    | "EMAIL_CHANGE"
    | "PHONE_VERIFY";
  tokenHash: string;
  expiresAt: Date;
  /** Token-specific data, such as the pending address of an EMAIL_CHANGE or
   * the phone number of a PHONE_VERIFY token. */
  payload?: Prisma.InputJsonValue;
}

/**
 * Stores a new action token and drops the user's older unused tokens of the
 * same type, so only the newest email link works. Doing both in one transaction
 * means a failure leaves the previous link intact rather than invalidating it
 * without replacing it.
 */
export function createAuthToken(input: CreateAuthTokenInput) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.authToken.create({ data: input });

    await tx.authToken.deleteMany({
      where: {
        userId: input.userId,
        type: input.type,
        usedAt: null,
        id: { not: created.id },
      },
    });

    return created;
  });
}

export function findAuthToken(
  tokenHash: string,
  type: "EMAIL_VERIFY" | "PASSWORD_RESET" | "EMAIL_CHANGE",
) {
  return prisma.authToken.findFirst({ where: { tokenHash, type } });
}

/**
 * Consumes the token and confirms the address atomically. The `updateMany`
 * guard is what makes the link single-use: two concurrent clicks cannot both
 * find `usedAt` null and proceed.
 */
export function consumeAuthTokenAndVerifyEmail(
  tokenId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        id: tokenId,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      return null;
    }

    return tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
      include: { profile: true },
    });
  });
}

/**
 * Consumes the token, changes the password, and signs every device out in one
 * transaction. If the password change succeeded without revoking sessions, a
 * stolen session would survive the reset, which is the whole point of a reset.
 */
export function consumeAuthTokenAndResetPassword(
  tokenId: string,
  userId: string,
  passwordHash: string,
) {
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        id: tokenId,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      return null;
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.authToken.deleteMany({
      where: { userId, type: "PASSWORD_RESET", usedAt: null },
    });

    return user;
  });
}

export interface ListUsersInput {
  q?: string;
  limit: number;
  cursor?: string;
}

export function listUsers({ q, limit, cursor }: ListUsersInput) {
  return prisma.user.findMany({
    where: q
      ? { email: { contains: q, mode: "insensitive" as const } }
      : undefined,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: { profile: true },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}

/**
 * Finds an unused, non-expired phone OTP token for a specific user. The user
 * id is part of the lookup because six-digit codes collide across accounts.
 */
export function findPhoneOtp(
  tokenHash: string,
  userId: string,
) {
  return prisma.authToken.findFirst({
    where: { tokenHash, type: "PHONE_VERIFY", userId },
  });
}

/**
 * Consumes the OTP token and marks the phone as verified in one transaction.
 * The single-use `updateMany` guard prevents two submissions from verifying
 * the same code twice.
 */
export function consumePhoneOtpAndVerifyPhone(
  tokenId: string,
  userId: string,
  phoneE164: string,
) {
  return prisma.$transaction(async (tx) => {
    const consumed = await tx.authToken.updateMany({
      where: {
        id: tokenId,
        userId,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (consumed.count === 0) {
      return null;
    }

    return tx.user.update({
      where: { id: userId },
      data: { phoneE164, phoneVerifiedAt: new Date() },
    });
  });
}
