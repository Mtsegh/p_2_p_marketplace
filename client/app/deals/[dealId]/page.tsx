import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/page-container";
import { DealDetailView } from "@/components/deals/deal-detail-view";

export const metadata: Metadata = {
  title: "Deal",
};

// The dynamic id makes usePathname() in the header block prerendering under
// Cache Components, so this segment opts out of instant-navigation validation.
export const instant = false;

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;

  return (
    <PageContainer className="py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Deal details
      </h1>
      <div className="mt-8">
        <DealDetailView dealId={dealId} />
      </div>
    </PageContainer>
  );
}
