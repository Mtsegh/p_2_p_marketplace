"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  filtersToQuery,
  filtersKey,
  type BrowseFilters,
} from "@/lib/browse-filters";
import { fetchListings, type ListListingsResult } from "@/lib/listings-api";
import { ListingCard } from "./listing-card";

const PAGE_SIZE = 12;

/**
 * Client-side pagination for the public browse feed. The query key includes the
 * active filters, so changing a filter resets to that search's first page. The
 * server supplies the first page for a fast first paint; "Load more" appends
 * the next cursor page without a navigation, preserving scroll position.
 */
export function BrowseGrid({
  initialPage,
  filters,
}: {
  initialPage: ListListingsResult;
  filters: BrowseFilters;
}) {
  const key = filtersKey(filters);

  const query = useInfiniteQuery({
    queryKey: ["listings", "browse", key],
    queryFn: ({ pageParam }) =>
      fetchListings({
        ...filtersToQuery(filters, {
          limit: PAGE_SIZE,
          cursor: pageParam,
        }),
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialData: {
      pages: [initialPage],
      pageParams: [undefined],
    },
  });

  const listings = query.data.pages.flatMap((page) => page.listings);
  const total = query.data.pages[0]?.total ?? 0;

  if (listings.length === 0) {
    return (
      <EmptyState
        title="No listings found"
        description="Try changing or clearing your filters to see more items."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted" role="status">
        {listings.length} of {total} {total === 1 ? "listing" : "listings"}
      </p>

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
