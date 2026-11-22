import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { BrowseGrid } from "@/components/listings/browse-grid";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchListings } from "@/lib/listings-api";

export const metadata: Metadata = {
  title: "Browse",
  description: "Browse items for sale and exchange from members near you.",
};

/**
 * First page is fetched on the server so guests get a rendered grid. The
 * uncached fetch is wrapped in Suspense (required with Cache Components), and
 * BrowseGrid takes over for "Load more" pagination after hydration.
 */
async function InitialListings() {
  const firstPage = await fetchListings({ limit: 12 });

  return <BrowseGrid initialPage={firstPage} />;
}

function BrowseGridSkeleton() {
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

export default function BrowsePage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Browse
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Find items for sale or exchange near you.
      </p>
      <div className="mt-8">
        <Suspense fallback={<BrowseGridSkeleton />}>
          <InitialListings />
        </Suspense>
      </div>
    </PageContainer>
  );
}
