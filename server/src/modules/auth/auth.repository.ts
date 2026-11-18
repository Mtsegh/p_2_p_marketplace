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
  return prisma.user.findUnique({ where: { email } });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
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
    const createdUser = await tx.user.create({ data: user });
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
    include: { user: true },
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
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
}
