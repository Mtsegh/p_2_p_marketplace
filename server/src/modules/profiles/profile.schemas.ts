import { z } from "zod";

/**
 * Control characters would break the single-line rendering of a name or a
 * location (and can be used to spoof what a reader sees), so they are rejected
 * rather than stripped: silently rewriting someone's name is worse.
 */
const NO_CONTROL_CHARS = /^[^\p{Cc}]+$/u;

const displayName = z
  .string()
  .trim()
  .min(1, "Enter a display name")
  .max(60, "Use 60 characters or fewer")
  .regex(NO_CONTROL_CHARS, "Remove invisible control characters from the name");

/**
 * Bio and location may be cleared, so an empty string is valid. `.trim()` runs
 * before the length check, which makes a string of spaces equal to empty.
 *
 * The bio accepts line breaks but no other control characters; a name or a
 * location is single line.
 */
function hasForbiddenControlCharacter(value: string): boolean {
  return Array.from(value).some(
    (char) => char !== "\n" && char !== "\r" && /\p{Cc}/u.test(char),
  );
}

const bio = z
  .string()
  .trim()
  .max(500, "Use 500 characters or fewer")
  .refine(
    (value) => !hasForbiddenControlCharacter(value),
    "Remove invisible control characters",
  );

const location = z
  .string()
  .trim()
  .max(80, "Use 80 characters or fewer")
  .refine(
    (value) => !/\p{Cc}/u.test(value),
    "Remove invisible control characters",
  );

/**
 * PATCH semantics: every field is optional, but a body with none of them is a
 * client bug rather than a silent no-op.
 */
export const updateProfileSchema = z
  .object({ displayName, bio, location })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one profile field",
  });

export const profileParamsSchema = z
  .object({ userId: z.string().uuid("Profile id must be a UUID") })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
