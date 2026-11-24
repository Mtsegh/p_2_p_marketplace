import type { Review } from "../../generated/prisma/client.js";

export interface ReviewDto {
  id: string;
  dealId: string;
  authorId: string;
  subjectId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export function toReviewDto(review: Review): ReviewDto {
  return {
    id: review.id,
    dealId: review.dealId,
    authorId: review.authorId,
    subjectId: review.subjectId,
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt.toISOString(),
  };
}

export interface TrustStats {
  averageRating: number;
  reviewCount: number;
}
