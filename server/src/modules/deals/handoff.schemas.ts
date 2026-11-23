import { z } from "zod";

export const handoffCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^\d{3}\s?\d{3}$/, "Enter the 6-digit code (e.g. 482 915)"),
  })
  .strict();

export type HandoffCodeInput = z.infer<typeof handoffCodeSchema>;
