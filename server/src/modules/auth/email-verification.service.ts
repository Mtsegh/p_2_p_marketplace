import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { sendEmail } from "../email/email.queue.js";
import { verificationEmail } from "../email/templates/verification.js";
import {
  EMAIL_VERIFICATION_TTL_MS,
  createActionToken,
  hashActionToken,
  invalidActionLink,
} from "./action-tokens.js";
import * as repository from "./auth.repository.js";

const TTL_HOURS = EMAIL_VERIFICATION_TTL_MS / 3_600_000;

export function verificationUrl(token: string): string {
  const base = env.CLIENT_URL.replace(/\/+$/, "");

  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

/**
 * Issues a fresh verification link and mails it. Called from registration and
 * from the resend endpoint.
 *
 * A delivery failure is logged, not thrown: the account exists and the user is
 * signed in, so registration must not fail because the mail provider is down.
 * They can resend from their profile.
 */
export async function issueVerificationEmail(user: {
  id: string;
  email: string;
}): Promise<void> {
  const { token, tokenHash } = createActionToken();

  await repository.createAuthToken({
    userId: user.id,
    type: "EMAIL_VERIFY",
    tokenHash,
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  });

  const message = verificationEmail({
    url: verificationUrl(token),
    expiresInHours: TTL_HOURS,
  });

  try {
    await sendEmail({ to: user.email, ...message });
  } catch (error) {
    logger.error(
      { err: error, userId: user.id },
      "could not send the verification email",
    );
  }
}

/**
 * Confirms an address from the token in the emailed link. The token itself
 * never appears in a URL the API serves: the client posts it back, so email
 * scanners that prefetch links cannot consume it.
 */
export async function verifyEmail(token: string) {
  const record = await repository.findAuthToken(
    hashActionToken(token),
    "EMAIL_VERIFY",
  );

  if (!record) {
    throw invalidActionLink();
  }

  if (record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw invalidActionLink();
  }

  const user = await repository.consumeAuthTokenAndVerifyEmail(
    record.id,
    record.userId,
  );

  if (!user) {
    // Another request consumed it first.
    throw invalidActionLink();
  }

  return user;
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await repository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Your account is not active");
  }

  if (user.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_ALREADY_VERIFIED",
      409,
      "This address is already confirmed",
    );
  }

  await issueVerificationEmail(user);
}
