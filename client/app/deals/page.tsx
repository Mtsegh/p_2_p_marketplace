import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { DealsView } from "@/components/deals/deals-view";

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
        Manage the offers you have sent and received.
      </p>
      <div className="mt-8">
        <DealsView />
      </div>
    </PageContainer>
  );
}
