import { randomInt } from "node:crypto";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { sendSms } from "../sms/sms.provider.js";
import {
  PHONE_VERIFY_TTL_MS,
  hashActionToken,
  invalidActionLink,
} from "./action-tokens.js";
import * as repository from "./auth.repository.js";

const TTL_MINUTES = PHONE_VERIFY_TTL_MS / 60_000;

/** Six-digit numeric code. Short enough to type on a phone, long enough that
 * guessing is impractical under rate limiting. */
export function generateOtp(): string {
  return String(randomInt(100_000, 999_999));
}

/**
 * Sends a phone verification code to the given E.164 number. Only the phone
 * number is stored in the token payload; it is written to the user record only
 * after the code is verified.
 */
export async function sendPhoneOtp(
  userId: string,
  phoneE164: string,
): Promise<void> {
  const user = await repository.findUserById(userId);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Your account is not active");
  }

  if (user.phoneVerifiedAt) {
    throw new AppError(
      "PHONE_ALREADY_VERIFIED",
      409,
      "This phone number is already verified",
    );
  }

  const otp = generateOtp();

  await repository.createAuthToken({
    userId,
    type: "PHONE_VERIFY",
    tokenHash: hashActionToken(otp),
    expiresAt: new Date(Date.now() + PHONE_VERIFY_TTL_MS),
    payload: { phone: phoneE164 },
  });

  try {
    await sendSms({
      to: phoneE164,
      body: [
        `Your P2P Marketplace verification code is ${otp}.`,
        `It works for ${TTL_MINUTES} minutes and can be used once.`,
        "If you did not request this, you can ignore it.",
      ].join("\n"),
    });
  } catch (error) {
    logger.error(
      { err: error, userId, phone: phoneE164 },
      "could not send the phone verification SMS",
    );
    // The token exists but the SMS failed. The user can resend; do not leak
    // whether the phone number belongs to an account.
  }
}

/**
 * Verifies a phone OTP code. The code and phone number must match the pending
 * token, which is consumed on success. The phone number and verification time
 * are written to the user record atomically.
 */
export async function verifyPhoneOtp(
  userId: string,
  phoneE164: string,
  code: string,
): Promise<void> {
  const record = await repository.findPhoneOtp(
    hashActionToken(code),
    userId,
  );

  if (!record) {
    throw invalidActionLink();
  }

  if (record.usedAt || record.expiresAt.getTime() <= Date.now()) {
    throw invalidActionLink();
  }

  const payload = record.payload as { phone?: string } | null;

  if (!payload || payload.phone !== phoneE164) {
    throw invalidActionLink();
  }

  const user = await repository.consumePhoneOtpAndVerifyPhone(
    record.id,
    userId,
    phoneE164,
  );

  if (!user) {
    // Another request consumed it first.
    throw invalidActionLink();
  }
}

/**
 * Resends a verification code to the same phone number as the latest pending
 * token. Reuses the send path so a fresh token replaces the old one.
 */
export async function resendPhoneOtp(
  userId: string,
  phoneE164: string,
): Promise<void> {
  await sendPhoneOtp(userId, phoneE164);
}
