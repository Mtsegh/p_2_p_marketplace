import { env } from "../../config/env.js";
import { brevoProvider } from "./brevo.provider.js";
import { consoleProvider } from "./console.provider.js";
import { memoryProvider } from "./memory.provider.js";
import type { EmailProvider } from "./email.types.js";

/**
 * Single place that decides how email leaves the process. The rest of the code
 * imports `emailProvider` and never checks which one is active.
 */
export const emailProvider: EmailProvider = (() => {
  switch (env.EMAIL_PROVIDER) {
    case "brevo":
      return brevoProvider;
    case "memory":
      return memoryProvider;
    case "console":
      return consoleProvider;
  }
})();
