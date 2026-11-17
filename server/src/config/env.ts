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
