import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { BrowseExperience } from "@/components/listings/browse-experience";
import { Skeleton } from "@/components/ui/skeleton";
import { parseBrowseFilters, filtersToQuery } from "@/lib/browse-filters";
import { fetchCategories, fetchListings } from "@/lib/listings-api";

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse items for sale and exchange from members near you.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Reads filters from the URL and fetches the matching first page on the server
 * so guests get a rendered grid. The uncached fetch is wrapped in Suspense
 * (required with Cache Components); the client takes over filter changes and
 * "Load more" pagination.
 */
async function InitialResults({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filters = parseBrowseFilters(params);

  const [firstPage, categories] = await Promise.all([
    fetchListings(filtersToQuery(filters, { limit: 12 })),
    fetchCategories().catch(() => []),
  ]);

  return (
    <BrowseExperience
      filters={filters}
      categories={categories}
      initialPage={firstPage}
    />
  );
}

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-lg border border-line bg-surface"
        >
          <Skeleton className="aspect-square w-full rounded-none" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Browse
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Find items for sale or exchange near you.
      </p>
      <div className="mt-8">
        <Suspense fallback={<BrowseSkeleton />}>
          <InitialResults searchParams={searchParams} />
        </Suspense>
      </div>
    </PageContainer>
  );
}
