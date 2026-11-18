import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import type { EmailMessage, EmailProvider } from "./email.types.js";

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const REQUEST_TIMEOUT_MS = 10_000;

interface BrevoErrorBody {
  code?: string;
  message?: string;
}

/**
 * Brevo transactional email over its REST API. Deliberately no SDK: the call is
 * one POST, and a direct fetch keeps the dependency surface small.
 *
 * The API key is read once at startup. It is never included in thrown errors or
 * logs; failures surface as status plus Brevo's message, which is what the
 * queue retry logic needs.
 */
export const brevoProvider: EmailProvider = {
  name: "brevo",

  async send(message: EmailMessage): Promise<void> {
    if (!env.BREVO_API_KEY) {
      throw new Error("BREVO_API_KEY is not configured");
    }

    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          email: env.EMAIL_FROM_ADDRESS,
          name: env.EMAIL_FROM_NAME,
        },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) {
      return;
    }

    const body = (await response
      .json()
      .catch(() => null)) as BrevoErrorBody | null;

    logger.warn(
      { status: response.status, brevoCode: body?.code },
      "brevo rejected a transactional email",
    );

    throw new Error(
      `Brevo responded ${response.status}${body?.message ? `: ${body.message}` : ""}`,
    );
  },
};
