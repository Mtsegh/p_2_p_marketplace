import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { consoleProvider } from "./console.provider.js";
import { memoryProvider } from "./memory.provider.js";
import type { SmsMessage, SmsProvider } from "./sms.types.js";

/**
 * Single place that decides how SMS leaves the process. The rest of the code
 * imports `smsProvider` and `sendSms` and never checks which one is active.
 */
export const smsProvider: SmsProvider = (() => {
  switch (env.SMS_PROVIDER) {
    case "memory":
      return memoryProvider;
    case "console":
      return consoleProvider;
  }
})();

/**
 * Hands a message to the provider. Delivery failures are not swallowed: a lost
 * verification code blocks the user, so the caller must handle the error.
 */
export async function sendSms(message: SmsMessage): Promise<void> {
  try {
    await smsProvider.send(message);
  } catch (error) {
    logger.warn({ err: error, to: message.to }, "SMS delivery failed");
    throw error;
  }
}
