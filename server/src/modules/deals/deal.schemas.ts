import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

/** A sale proposal: the buyer offers a price for an active listing. */
export const createProposalSchema = z
  .object({
    listingId: id,
    amountCents: z
      .number()
      .int()
      .min(1, "Enter an offer amount")
      .max(10_000_000_00, "Offer is too high"),
  })
  .strict();

export const dealParamsSchema = z.object({ dealId: id }).strict();

export const listDealsQuerySchema = z
  .object({
    role: z.enum(["buyer", "seller", "all"]).default("all"),
    status: z
      .enum([
        "PROPOSED",
        "ACCEPTED",
        "REJECTED",
        "CANCELLED",
        "PAYMENT_PENDING",
        "COMPLETED",
        "DISPUTED",
        "RESOLVED",
      ])
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().max(256).optional(),
  })
  .strict();

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;
