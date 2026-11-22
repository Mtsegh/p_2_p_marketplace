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

const envSchema = z
  .object({
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
    /**
     * How outbound email leaves the process. `brevo` calls the Brevo API,
     * `console` writes the message to the log (local development), and `memory`
     * keeps it in an array for tests.
     */
    EMAIL_PROVIDER: z.enum(["brevo", "console", "memory"]).default("console"),
    /** Brevo API key. Empty is accepted outside production, where `console` is used. */
    BREVO_API_KEY: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() === "" ? undefined : value,
      z.string().trim().min(1).optional(),
    ),
    /** How outbound SMS leaves the process. `console` writes the message to the
     * log (local development), and `memory` keeps it in an array for tests. */
    SMS_PROVIDER: z.enum(["console", "memory"]).default("console"),
    /** How object storage for listing images behaves. `s3` uploads to an
     * S3-compatible bucket, `memory` keeps uploads in RAM for tests. */
    STORAGE_PROVIDER: z.enum(["s3", "memory"]).default("memory"),
    /** S3 bucket name for listing images. */
    S3_BUCKET: z.string().trim().min(1).optional(),
    /** S3 region. */
    S3_REGION: z.string().trim().min(1).default("us-east-1"),
    /** S3 access key ID. Empty outside production is accepted. */
    S3_ACCESS_KEY_ID: z.string().trim().min(1).optional(),
    /** S3 secret access key. Empty outside production is accepted. */
    S3_SECRET_ACCESS_KEY: z.string().trim().min(1).optional(),
    /** S3 endpoint for S3-compatible services (MinIO, R2, etc.). */
    S3_ENDPOINT: z.string().trim().min(1).optional(),
    /** Whether to use path-style S3 URLs (required for MinIO). */
    S3_FORCE_PATH_STYLE: z.preprocess(
      (value) => value === "true" || value === true,
      z.boolean().default(false),
    ),
    /** Public base URL for S3 objects (CDN or bucket website URL). */
    S3_PUBLIC_URL: z.string().trim().min(1).optional(),
    /** How long presigned PUT URLs are valid, in seconds. */
    S3_PRESIGN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
    EMAIL_FROM_ADDRESS: z
      .string()
      .trim()
      .email("must be a valid address")
      .default("no-reply@marketplace.test"),
    EMAIL_FROM_NAME: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .default("P2P Marketplace"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((value, context) => {
    // Production must actually deliver mail. Failing at boot is better than
    // discovering during a password reset that nothing was ever sent.
    if (value.NODE_ENV === "production" && value.EMAIL_PROVIDER !== "brevo") {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_PROVIDER"],
        message: "must be brevo in production",
      });
    }

    if (value.NODE_ENV === "production" && !value.BREVO_API_KEY) {
      context.addIssue({
        code: "custom",
        path: ["BREVO_API_KEY"],
        message: "is required when EMAIL_PROVIDER is brevo",
      });
    }

    if (value.NODE_ENV === "production" && value.STORAGE_PROVIDER === "s3") {
      if (!value.S3_BUCKET) {
        context.addIssue({
          code: "custom",
          path: ["S3_BUCKET"],
          message: "is required when STORAGE_PROVIDER is s3",
        });
      }
      if (!value.S3_ACCESS_KEY_ID) {
        context.addIssue({
          code: "custom",
          path: ["S3_ACCESS_KEY_ID"],
          message: "is required when STORAGE_PROVIDER is s3",
        });
      }
      if (!value.S3_SECRET_ACCESS_KEY) {
        context.addIssue({
          code: "custom",
          path: ["S3_SECRET_ACCESS_KEY"],
          message: "is required when STORAGE_PROVIDER is s3",
        });
      }
    }
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
