import { pino } from "pino";
import { env } from "../config/env.js";

const isDevelopment = env.NODE_ENV === "development";

/**
 * Structured logger. Everything goes through here; `console` is only used by
 * the env module before the logger exists.
 *
 * Redaction covers credentials, cookies, and tokens. Email and phone numbers
 * are never logged by request handlers, and the default HTTP serializer does
 * not include request bodies or headers.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "marketplace-api", environment: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "password",
      "*.password",
      "token",
      "*.token",
      "passwordHash",
      "*.passwordHash",
      "tokenHash",
      "*.tokenHash",
    ],
    censor: "[redacted]",
  },
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname,service,environment",
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
