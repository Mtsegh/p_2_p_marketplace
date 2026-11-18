import "dotenv/config";
import { z } from "zod";

/**
 * Validates a value as a URL whose protocol is one of `protocols`.
 * Kept local so config stays the only module that touches process.env.
 */
const protocolUrl = (protocols: readonly string[]) =>
  z.string().refine(
    (value) => {
      try {
        return protocols.includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    `must start with ${protocols.join(" or ")}`,
  );

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CLIENT_URL: protocolUrl(["http:", "https:"]),
  DATABASE_URL: protocolUrl(["postgresql:", "postgres:"]),
  REDIS_URL: protocolUrl(["redis:", "rediss:"]),
  /** HMAC key for access tokens. Rotating it signs every user out. */
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "must be at least 32 characters")
    .max(512),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(3_600)
    .default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map(
    (issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`,
  );

  console.error(
    [
      "Invalid environment configuration:",
      ...problems,
      "",
      "Copy server/.env.example to server/.env and fix the values above.",
    ].join("\n"),
  );

  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
