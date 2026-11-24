import { apiRequest, apiRequestJson } from "./api";

export interface Review {
  id: string;
  dealId: string;
  authorId: string;
  subjectId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface TrustStats {
  averageRating: number;
  reviewCount: number;
}

export interface ReviewList {
  reviews: Review[];
  nextCursor: string | null;
}

export async function fetchTrustStats(userId: string): Promise<TrustStats> {
  const response = await apiRequest<{ data: TrustStats }>(
    `/api/v1/reviews/trust?userId=${encodeURIComponent(userId)}`,
  );

  return response.data;
}

export async function fetchReviews(
  userId: string,
  cursor?: string,
): Promise<ReviewList> {
  const params = new URLSearchParams({ userId });
  if (cursor) params.set("cursor", cursor);

  const response = await apiRequest<{ data: ReviewList }>(
    `/api/v1/reviews?${params.toString()}`,
  );

  return response.data;
}

export async function createReview(input: {
  dealId: string;
  rating: number;
  comment?: string;
}): Promise<Review> {
  const response = await apiRequestJson<{ data: { review: Review } }>(
    "/api/v1/reviews",
    "POST",
    input,
  );

  return response.data.review;
}

export async function fetchMyReview(
  dealId: string,
): Promise<Review | null> {
  const response = await apiRequest<{ data: { review: Review | null } }>(
    `/api/v1/reviews/mine?dealId=${encodeURIComponent(dealId)}`,
  );

  return response.data.review;
}
