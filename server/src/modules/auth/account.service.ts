import { randomBytes } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import * as accountRepository from "./account.repository.js";
import * as authRepository from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import { denySession } from "./token-denylist.js";

/**
 * Account settings that need the current password. The password check is the
 * whole point: a stolen session alone must not be able to change credentials,
 * the sign-in address, or destroy the account.
 */
function invalidPassword(message: string): AppError {
  return new AppError("INVALID_PASSWORD", 400, message);
}

async function requireActiveUser(userId: string) {
  const user = await authRepository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Your account is not active");
  }

  return user;
}

/**
 * Changes the password and signs every other device out. The device making the
 * request stays signed in, which is what someone changing their password
 * expects. Revoked sessions are denylisted so their access tokens stop now
 * instead of at their natural 15-minute expiry.
 */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: { currentPassword: string; newPassword: string },
): Promise<void> {
  const user = await requireActiveUser(userId);
  const matches = await verifyPassword(
    user.passwordHash,
    input.currentPassword,
  );

  if (!matches) {
    throw invalidPassword("The current password is incorrect");
  }

  const passwordHash = await hashPassword(input.newPassword);
  const revoked = await accountRepository.changePasswordAndRevokeOtherSessions(
    userId,
    currentSessionId,
    passwordHash,
  );

  await Promise.all(revoked.map((sessionId) => denySession(sessionId)));
}

/**
 * Deletes the account behind the request. Because the row is anonymized rather
 * than dropped, the session that asked for it no longer belongs to an active
 * user, so the caller clears the refresh cookie afterwards.
 */
export async function deleteAccount(
  userId: string,
  input: { password: string },
): Promise<void> {
  const user = await requireActiveUser(userId);
  const matches = await verifyPassword(user.passwordHash, input.password);

  if (!matches) {
    throw invalidPassword("The password is incorrect");
  }

  // A real argon2 hash of a value nobody knows: logins keep behaving normally
  // (they simply never match) instead of hitting an unparsable hash.
  const unusablePasswordHash = await hashPassword(
    randomBytes(32).toString("base64url"),
  );

  const revoked = await accountRepository.anonymizeAccount(
    userId,
    unusablePasswordHash,
  );

  await Promise.all(revoked.map((sessionId) => denySession(sessionId)));
}

export interface AccountExport {
  exportedAt: string;
  account: {
    id: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  profile: {
    displayName: string;
    bio: string;
    location: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  sessions: {
    id: string;
    userAgent: string | null;
    ip: string | null;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }[];
}

/**
 * Everything the account owns in a portable document. Password hashes, action
 * tokens, and refresh-token hashes are deliberately left out: an export is for
 * the user's records, not a credential dump.
 */
export async function exportAccountData(
  userId: string,
): Promise<AccountExport> {
  const account = await accountRepository.findAccountExport(userId);

  if (!account) {
    throw AppError.unauthorized("Your account is not active");
  }

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: account.id,
      email: account.email,
      role: account.role,
      status: account.status,
      emailVerified: account.emailVerifiedAt !== null,
      phoneVerified: account.phoneVerifiedAt !== null,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    },
    profile: account.profile
      ? {
          displayName: account.profile.displayName,
          bio: account.profile.bio,
          location: account.profile.location,
          createdAt: account.profile.createdAt.toISOString(),
          updatedAt: account.profile.updatedAt.toISOString(),
        }
      : null,
    sessions: account.sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
    })),
  };
}
