import { z } from "zod";

/** Minimal payout details. A real gateway needs far more (bank/tax data); the
 * test provider only requires a supported country code. */
export const onboardSchema = z
  .object({
    country: z
      .string()
      .trim()
      .length(2, "Country must be a two-letter code")
      .regex(/^[A-Za-z]{2}$/, "Country must be a two-letter code")
      .transform((value) => value.toUpperCase()),
  })
  .strict();

export type OnboardInput = z.infer<typeof onboardSchema>;
