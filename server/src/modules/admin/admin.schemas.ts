import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const userStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
  })
  .strict();

export const moderateListingSchema = z
  .object({
    action: z.enum(["remove", "restore"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

/** Only known settings may be edited, with explicit ranges. */
export const settingsSchema = z
  .object({
    platformFeeBps: z.number().int().min(0).max(5000).optional(),
    escrowWindowDays: z.number().int().min(1).max(90).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one setting",
  });

export const auditQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export const listingsQuerySchema = z
  .object({
    status: z
      .enum(["DRAFT", "ACTIVE", "RESERVED", "SOLD", "EXCHANGED", "REMOVED"])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export const userParamsSchema = z.object({ userId: id }).strict();
export const listingParamsSchema = z.object({ listingId: id }).strict();

export type SettingsInput = z.infer<typeof settingsSchema>;
export type ListingParams = z.infer<typeof listingsQuerySchema>;
export type AuditParams = z.infer<typeof auditQuerySchema>;
export type UserParams = z.infer<typeof userParamsSchema>;
export type ListingIdParams = z.infer<typeof listingParamsSchema>;
