import type { z } from "zod";
import { AppError } from "./app-error.js";

/**
 * Parses untrusted input with a zod schema and throws the standard validation
 * error on failure. Controllers call this instead of touching `safeParse`
 * directly so every endpoint returns the same error shape.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw AppError.validation(
      result.error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        issue: issue.message,
      })),
    );
  }

  return result.data;
}
