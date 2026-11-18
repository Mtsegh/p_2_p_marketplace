import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Sell",
};

export default function SellPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Sell an item
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Turn something you no longer need into cash or a swap.
      </p>
      <div className="mt-8">
        <EmptyState
          title="Listing creation is not open yet"
          description="Listing creation opens soon. In the meantime, browse what is already available."
          action={
            <ButtonLink href="/browse" variant="secondary">
              Browse listings
            </ButtonLink>
          }
        />
      </div>
    </PageContainer>
  );
}
