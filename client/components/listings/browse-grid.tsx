"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { fetchListings, type ListListingsResult } from "@/lib/listings-api";
import { ListingCard } from "./listing-card";

const PAGE_SIZE = 12;

/**
 * Client-side pagination for the public browse feed. The first page is fetched
 * by the server for a fast first paint, then this component takes over: "Load
 * more" appends the next cursor page without a navigation, so scroll position
 * is preserved.
 */
export function BrowseGrid({
  initialPage,
}: {
  initialPage: ListListingsResult;
}) {
  const query = useInfiniteQuery({
    queryKey: ["listings", "browse"],
    queryFn: ({ pageParam }) =>
      fetchListings({ cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: {
      pages: [initialPage],
      pageParams: [undefined],
    },
  });

  const listings = query.data.pages.flatMap((page) => page.listings);

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings yet"
        description="Listings will appear here as sellers publish them. Be the first to put something up."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>

      {query.isError ? (
        <Alert tone="danger" title="Could not load more listings">
          {query.error instanceof Error
            ? query.error.message
            : "Check your connection and try again."}
        </Alert>
      ) : null}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-muted">
          You&apos;ve reached the end of the listings.
        </p>
      )}
    </div>
  );
}
