import { logger } from "../../lib/logger.js";
import type { EmailMessage, EmailProvider } from "./email.types.js";

/**
 * Development adapter: nothing leaves the machine. The full text body is logged
 * so verification and reset links can be followed by copying them out of the
 * console. Never selected in production; env validation rejects it there.
 */
export const consoleProvider: EmailProvider = {
  name: "console",

  async send(message: EmailMessage): Promise<void> {
    logger.info(
      { to: message.to, subject: message.subject },
      "email suppressed (console provider)\n%s",
      message.text,
    );
  },
};
