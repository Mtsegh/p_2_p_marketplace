import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const openDisputeSchema = z
  .object({
    dealId: id,
    reason: z
      .string()
      .trim()
      .min(10, "Describe the problem (at least 10 characters)")
      .max(2000, "Reason is too long"),
  })
  .strict();

export const disputeParamsSchema = z.object({ dealId: id }).strict();
export const disputeIdParamsSchema = z.object({ disputeId: id }).strict();

export const resolveDisputeSchema = z
  .object({
    resolution: z.enum(["RELEASE", "REFUND", "SPLIT"]),
    note: z.string().trim().max(1000).optional(),
  })
  .strict();

export const listDisputesQuerySchema = z
  .object({
    status: z.enum(["OPEN", "RESOLVED"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export type ResolveDisputeInput = z.infer<typeof resolveDisputeSchema>;
