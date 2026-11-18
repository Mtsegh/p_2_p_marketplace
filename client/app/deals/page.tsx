import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Deals",
};

export default function DealsPage() {
  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Deals
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        Track every offer and handoff in one place.
      </p>
      <div className="mt-8">
        <EmptyState
          title="No deals yet"
          description="Proposals you send or receive will appear here, along with their current status."
        />
      </div>
    </PageContainer>
  );
}
