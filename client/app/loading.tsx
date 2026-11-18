import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <div role="status">
        <span className="sr-only">Loading page</span>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-10 w-3/4 max-w-xl" />
        <Skeleton className="mt-3 h-4 w-2/3 max-w-lg" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </PageContainer>
  );
}
