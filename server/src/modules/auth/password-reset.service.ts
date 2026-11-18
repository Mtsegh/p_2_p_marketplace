import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { sendEmail } from "../email/email.queue.js";
import { passwordResetEmail } from "../email/templates/password-reset.js";
import {
  PASSWORD_RESET_TTL_MS,
  createActionToken,
  hashActionToken,
} from "./action-tokens.js";
import * as repository from "./auth.repository.js";
import { hashPassword } from "./password.js";

const TTL_MINUTES = PASSWORD_RESET_TTL_MS / 60_000;

export function resetUrl(token: string): string {
  const base = env.CLIENT_URL.replace(/\/+$/, "");

  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

function invalidLink(): AppError {
  return new AppError(
    "INVALID_TOKEN",
    400,
    "This link is invalid or has expired. Request a new one.",
  );
}

/**
 * Starts a reset. Returns silently whether or not the address exists, so the
 * endpoint cannot be used to discover who has an account. Suspended and deleted
 * accounts are ignored too: they cannot sign in anyway.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await repository.findUserByEmail(email);

  if (!user || user.status !== "ACTIVE") {
    return;
  }

  const { token, tokenHash } = createActionToken();

  await repository.createAuthToken({
    userId: user.id,
    type: "PASSWORD_RESET",
    tokenHash,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });

  const message = passwordResetEmail({
    url: resetUrl(token),
    expiresInMinutes: TTL_MINUTES,
  });

  try {
    await sendEmail({ to: user.email, ...message });
  } catch (error) {
    logger.error(
      { err: error, userId: user.id },
      "could not send the password reset email",
    );
  }
}

/**
 * Sets a new password from the emailed token. The repository revokes every
 * session in the same transaction, so a stolen session cannot outlive the
 * reset. The access token attached to such a session still works until it
 * expires (15 minutes), which is the documented cost of a stateless token.
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  const record = await repository.findAuthToken(
    hashActionToken(token),
    "PASSWORD_RESET",
  );

  if (!record) {
    throw invalidLink();
  }

  if (record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw invalidLink();
  }

  const passwordHash = await hashPassword(password);
  const user = await repository.consumeAuthTokenAndResetPassword(
    record.id,
    record.userId,
    passwordHash,
  );

  if (!user) {
    throw invalidLink();
  }
}
