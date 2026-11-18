import { randomBytes } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import { sha256Hex } from "../../lib/hash.js";

/**
 * Action tokens (email verification, password reset, email change) are opaque
 * random strings sent by email. Only their hash is stored, exactly like refresh
 * tokens, so a database leak cannot be turned into account takeover.
 *
 * 32 bytes is well beyond guessing range; the expiry and single-use rules are
 * what limit the damage of an intercepted email.
 */
export function createActionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");

  return { token, tokenHash: hashActionToken(token) };
}

export function hashActionToken(token: string): string {
  return sha256Hex(token);
}

/**
 * One wording for every unusable link, whichever token type it was. The API
 * never tells the caller whether a token is unknown, expired, or already spent.
 */
export function invalidActionLink(): AppError {
  return new AppError(
    "INVALID_TOKEN",
    400,
    "This link is invalid or has expired. Request a new one.",
  );
}

const HOUR_MS = 3_600_000;

/** Long enough to survive a night without reopening the app. */
export const EMAIL_VERIFICATION_TTL_MS = 24 * HOUR_MS;

/** Short on purpose: a reset link is the most dangerous email we send. */
export const PASSWORD_RESET_TTL_MS = HOUR_MS;

/**
 * An email change needs a password and a click on a link sent to the new
 * address, so the window is short: the address being proven is the whole point.
 */
export const EMAIL_CHANGE_TTL_MS = HOUR_MS;
