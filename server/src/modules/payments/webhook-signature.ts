import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";

/**
 * Verifies a gateway webhook signature over the RAW request body. Comparing a
 * freshly computed HMAC with the supplied signature using timingSafeEqual
 * avoids leaking the secret through timing differences.
 */
export function signWebhookBody(rawBody: string): string {
  return createHmac("sha256", env.WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
}

export function assertValidSignature(
  rawBody: string,
  signature: string | undefined,
): void {
  if (!signature) {
    throw new AppError("INVALID_SIGNATURE", 401, "Missing webhook signature");
  }

  const expected = signWebhookBody(rawBody);
  const provided = signature.toLowerCase();

  // Both are 64-char hex strings; only compare when lengths match.
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    throw new AppError("INVALID_SIGNATURE", 401, "Invalid webhook signature");
  }
}
