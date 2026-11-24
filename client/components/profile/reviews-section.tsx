"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchReviews, fetchTrustStats } from "@/lib/reviews-api";

/** Trust badge and reviews shown on a member's public profile. */
export function ReviewsSection({ userId }: { userId: string }) {
  const stats = useQuery({
    queryKey: ["trust", userId],
    queryFn: () => fetchTrustStats(userId),
  });

  const reviews = useInfiniteQuery({
    queryKey: ["reviews", userId],
    queryFn: ({ pageParam }) => fetchReviews(userId, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const items = reviews.data?.pages.flatMap((page) => page.reviews) ?? [];

  return (
    <section aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="reviews-heading" className="text-lg font-semibold">
          Reviews
        </h2>
        {stats.data && stats.data.reviewCount > 0 ? (
          <Badge tone="success">
            ★ {stats.data.averageRating.toFixed(1)} ({stats.data.reviewCount})
          </Badge>
        ) : null}
      </div>

      {reviews.isLoading ? <p className="mt-2 text-muted">Loading reviews…</p> : null}

      {items.length === 0 && !reviews.isLoading ? (
        <p className="mt-2 text-sm text-muted">
          No reviews yet. Reviews appear after a completed deal.
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {items.map((review) => (
          <li
            key={review.id}
            className="rounded-lg border border-line bg-surface p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-warning">
                {"★".repeat(review.rating)}
                {"☆".repeat(5 - review.rating)}
              </span>
              <time className="text-xs text-muted">
                {new Date(review.createdAt).toLocaleDateString("en-US")}
              </time>
            </div>
            {review.comment ? (
              <p className="mt-2 whitespace-pre-line text-sm text-muted">
                {review.comment}
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {reviews.hasNextPage ? (
        <div className="mt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => reviews.fetchNextPage()}
            loading={reviews.isFetchingNextPage}
            disabled={reviews.isFetchingNextPage}
          >
            More reviews
          </Button>
        </div>
      ) : null}
    </section>
  );
}
