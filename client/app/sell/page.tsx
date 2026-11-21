import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { CreateListingForm } from "@/components/listings/create-listing-form";
import { fetchCategories } from "@/lib/listings-api";

export const metadata: Metadata = {
  title: "Sell an item",
};

export default async function SellPage() {
  let categories: { id: string; name: string; slug: string }[] = [];

  try {
    categories = await fetchCategories();
  } catch {
    // Categories are optional; the form still works without them.
  }

  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Sell an item
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Turn something you no longer need into cash or a swap.
      </p>
      <div className="mt-8 max-w-xl">
        {categories.length > 0 ? (
          <CreateListingForm categories={categories} />
        ) : (
          <EmptyState
            title="Categories not available"
            description="Could not load categories right now. You can still create a listing without a category."
            action={
              <ButtonLink href="/browse" variant="secondary">
                Browse listings
              </ButtonLink>
            }
          />
        )}
      </div>
    </PageContainer>
  );
}
