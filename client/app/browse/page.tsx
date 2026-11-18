import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Browse",
};

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
        <EmptyState
          title="No listings yet"
          description="Listings will appear here as sellers publish them. Be the first to put something up."
          action={
            <ButtonLink href="/sell" variant="secondary">
              List an item
            </ButtonLink>
          }
        />
      </div>
    </PageContainer>
  );
}
