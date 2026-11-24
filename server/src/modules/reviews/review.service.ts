import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import type { CreateReviewInput } from "./review.schemas.js";
import type { TrustStats } from "./review.dto.js";

/**
 * Creates a review. Rules: the deal must be COMPLETED, the author must be one
 * of its two participants, the subject is the other participant, and each
 * author may review a deal only once.
 */
export async function createReview(
  authorId: string,
  input: CreateReviewInput,
) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({ where: { id: input.dealId } });

    if (!deal) {
      throw AppError.notFound("Deal not found");
    }

    if (deal.status !== "COMPLETED") {
      throw new AppError(
        "DEAL_NOT_COMPLETED",
        409,
        "Reviews are only available after a deal completes",
      );
    }

    if (deal.buyerId !== authorId && deal.sellerId !== authorId) {
      throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
    }

    const subjectId = deal.buyerId === authorId ? deal.sellerId : deal.buyerId;

    try {
      return await tx.review.create({
        data: {
          dealId: input.dealId,
          authorId,
          subjectId,
          rating: input.rating,
          comment: input.comment,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError("REVIEW_EXISTS", 409, "You already reviewed this deal");
      }
      throw error;
    }
  });
}

/** Paginated reviews for a user (the public trust signal). */
export async function listReviewsForUser(
  userId: string,
  limit: number,
  cursor?: string,
) {
  const rows = await prisma.review.findMany({
    where: { subjectId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    reviews: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/** Average rating and count for a user, used for the trust badge. */
export async function trustStats(userId: string): Promise<TrustStats> {
  const result = await prisma.review.aggregate({
    where: { subjectId: userId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    averageRating: Math.round((result._avg.rating ?? 0) * 10) / 10,
    reviewCount: result._count.rating,
  };
}

/** Finds a review authored by a user for a deal (for the client to show state). */
export async function findMyReview(dealId: string, authorId: string) {
  return prisma.review.findUnique({
    where: { dealId_authorId: { dealId, authorId } },
  });
}
