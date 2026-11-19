import { logger } from "../../lib/logger.js";
import type { SmsMessage, SmsProvider } from "./sms.types.js";

/**
 * Development adapter: nothing leaves the machine. The full message body is
 * logged so verification codes can be copied out of the console. Never
 * selected in production; env validation rejects unknown providers.
 */
export const consoleProvider: SmsProvider = {
  name: "console",

  async send(message: SmsMessage): Promise<void> {
    logger.info(
      { to: message.to },
      "SMS suppressed (console provider)\n%s",
      message.body,
    );
  },
};
