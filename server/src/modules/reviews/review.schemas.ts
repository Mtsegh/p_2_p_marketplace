import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const createReviewSchema = z
  .object({
    dealId: id,
    rating: z.number().int().min(1, "Rating must be 1-5").max(5, "Rating must be 1-5"),
    comment: z.string().trim().max(2000, "Comment is too long").optional(),
  })
  .strict();

export const reviewsQuerySchema = z
  .object({
    userId: id,
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
  })
  .strict();

export const trustQuerySchema = z
  .object({ userId: id })
  .strict();

export const myReviewQuerySchema = z
  .object({ dealId: id })
  .strict();

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
