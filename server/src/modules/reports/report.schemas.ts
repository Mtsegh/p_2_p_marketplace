import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const createReportSchema = z
  .object({
    targetType: z.enum(["listing", "user"]),
    targetId: id,
    reason: z
      .string()
      .trim()
      .min(10, "Describe the problem (at least 10 characters)")
      .max(2000, "Reason is too long"),
  })
  .strict();

export const resolveReportSchema = z
  .object({
    action: z.enum(["actioned", "dismissed"]),
    note: z.string().trim().max(1000).optional(),
    /** When actioning a user report, suspend them. */
    suspendUser: z.boolean().optional(),
  })
  .strict();

export const reportIdParamsSchema = z.object({ reportId: id }).strict();

export const listReportsQuerySchema = z
  .object({
    status: z.enum(["OPEN", "ACTIONED", "DISMISSED"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export type CreateReportInput = z.infer<typeof createReportSchema>;
