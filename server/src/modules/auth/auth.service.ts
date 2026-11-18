import { randomUUID } from "node:crypto";
import { Prisma, type User } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/app-error.js";
import * as repository from "./auth.repository.js";
import type { SessionDto } from "./auth.dto.js";
import { absorbLoginTiming, hashPassword, verifyPassword } from "./password.js";
import { denySession } from "./token-denylist.js";
import {
  accessTokenTtlSeconds,
  createRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./tokens.js";

/**
 * If an already-rotated token is presented within this window, another tab or a
 * retried request raced the rotation. Answer 401 so the client retries with the
 * cookie set by the winner. Outside the window a replay is treated as theft and
 * the whole token family is revoked.
 */
const ROTATION_GRACE_MS = 10_000;

export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

function invalidCredentials(): AppError {
  // Uniform for unknown email, wrong password, and deleted accounts.
  return new AppError(
    "INVALID_CREDENTIALS",
    401,
    "The email or password is incorrect",
  );
}

function invalidRefreshToken(): AppError {
  return new AppError(
    "INVALID_REFRESH_TOKEN",
    401,
    "Your session has ended. Sign in again.",
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function issueSession(
  user: User,
  context: RequestContext,
): Promise<AuthResult> {
  const { token, tokenHash } = createRefreshToken();

  const session = await repository.createSession({
    userId: user.id,
    tokenHash,
    familyId: randomUUID(),
    expiresAt: refreshTokenExpiry(),
    userAgent: context.userAgent,
    ip: context.ip,
  });

  const accessToken = await signAccessToken({
    userId: user.id,
    sessionId: session.id,
    role: user.role,
  });

  return {
    user,
    accessToken,
    refreshToken: token,
    expiresIn: accessTokenTtlSeconds,
  };
}

export async function register(
  input: { email: string; password: string },
  context: RequestContext,
): Promise<AuthResult> {
  const passwordHash = await hashPassword(input.password);
  const { token, tokenHash } = createRefreshToken();
  const familyId = randomUUID();

  try {
    const { user, session } = await repository.createUserWithSession(
      { email: input.email, passwordHash },
      {
        tokenHash,
        familyId,
        expiresAt: refreshTokenExpiry(),
        userAgent: context.userAgent,
        ip: context.ip,
      },
    );

    const accessToken = await signAccessToken({
      userId: user.id,
      sessionId: session.id,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken: token,
      expiresIn: accessTokenTtlSeconds,
    };
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        "EMAIL_IN_USE",
        409,
        "An account with this email already exists",
      );
    }

    throw error;
  }
}

export async function login(
  input: { email: string; password: string },
  context: RequestContext,
): Promise<AuthResult> {
  const user = await repository.findUserByEmail(input.email);

  if (!user) {
    await absorbLoginTiming(input.password);
    throw invalidCredentials();
  }

  const passwordMatches = await verifyPassword(
    user.passwordHash,
    input.password,
  );

  if (!passwordMatches || user.status === "DELETED") {
    throw invalidCredentials();
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(
      "ACCOUNT_SUSPENDED",
      403,
      "This account is suspended. Contact support for help.",
    );
  }

  return issueSession(user, context);
}

export async function refresh(
  refreshToken: string,
  context: RequestContext,
): Promise<AuthResult> {
  const session = await repository.findSessionByTokenHash(
    hashRefreshToken(refreshToken),
  );

  if (!session) {
    throw invalidRefreshToken();
  }

  if (session.revokedAt) {
    if (Date.now() - session.revokedAt.getTime() > ROTATION_GRACE_MS) {
      await repository.revokeFamily(session.familyId);
    }

    throw invalidRefreshToken();
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await repository.revokeSessionById(session.id);
    throw invalidRefreshToken();
  }

  if (session.user.status !== "ACTIVE") {
    await repository.revokeFamily(session.familyId);
    throw invalidRefreshToken();
  }

  const { token, tokenHash } = createRefreshToken();
  const nextSession = await repository.rotateSession(session.id, {
    userId: session.userId,
    tokenHash,
    familyId: session.familyId,
    expiresAt: refreshTokenExpiry(),
    userAgent: context.userAgent,
    ip: context.ip,
  });

  if (!nextSession) {
    // Another request rotated first. Do not revoke the family: the winner has
    // a valid session and the client will retry with the new cookie.
    throw invalidRefreshToken();
  }

  const accessToken = await signAccessToken({
    userId: session.user.id,
    sessionId: nextSession.id,
    role: session.user.role,
  });

  return {
    user: session.user,
    accessToken,
    refreshToken: token,
    expiresIn: accessTokenTtlSeconds,
  };
}

/** Revokes the refresh session behind the cookie. Safe to call twice. */
export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) {
    return;
  }

  const session = await repository.findSessionByTokenHash(
    hashRefreshToken(refreshToken),
  );

  if (!session) {
    return;
  }

  await repository.revokeSessionById(session.id);
  await denySession(session.id);
}

export async function getAuthenticatedUser(userId: string): Promise<User> {
  const user = await repository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Your account is not active");
  }

  return user;
}

export async function listSessions(
  userId: string,
  currentSessionId: string,
): Promise<SessionDto[]> {
  const sessions = await repository.listActiveSessions(userId);

  return sessions.map((session) => ({
    id: session.id,
    userAgent: session.userAgent,
    ip: session.ip,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    current: session.id === currentSessionId,
  }));
}

/**
 * Revokes one of the caller's own sessions. The user id is part of the WHERE
 * clause, so a guessed session id belonging to someone else is a 404, never a
 * forbidden hint that it exists.
 */
export async function revokeOwnedSession(
  userId: string,
  sessionId: string,
  currentSessionId: string,
): Promise<{ revokedCurrent: boolean }> {
  const result = await repository.revokeOwnedSession(userId, sessionId);

  if (result.count === 0) {
    throw AppError.notFound("Session not found");
  }

  if (sessionId === currentSessionId) {
    await denySession(sessionId);
    return { revokedCurrent: true };
  }

  return { revokedCurrent: false };
}
