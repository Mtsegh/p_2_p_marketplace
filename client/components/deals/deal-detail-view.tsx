"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import {
  DEAL_STATUS_LABELS,
  fetchDeal,
  formatDealAmount,
} from "@/lib/deals-api";
import { Badge } from "@/components/ui/badge";
import { DealThread } from "@/components/deals/deal-thread";
import { PaymentPanel } from "@/components/deals/payment-panel";
import { HandoffPanel } from "@/components/deals/handoff-panel";
import { ExchangeConfirmPanel } from "@/components/deals/exchange-confirm-panel";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { useQuery } from "@tanstack/react-query";

function DealDetail({ dealId, userId }: { dealId: string; userId: string }) {
  const query = useQuery({
    queryKey: ["deal", dealId],
    queryFn: () => fetchDeal(dealId),
  });

  if (query.isLoading) {
    return <p className="text-muted">Loading deal…</p>;
  }

  if (query.isError) {
    return (
      <Alert tone="danger" title="Could not load this deal">
        It may not exist, or you may not have access to it.
      </Alert>
    );
  }

  if (!query.data) {
    return null;
  }

  const deal = query.data;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{deal.listingTitle}</h2>
            <p className="mt-1 text-sm text-muted">
              {deal.buyerId === userId
                ? `Seller: ${deal.sellerDisplayName}`
                : `Buyer: ${deal.buyerDisplayName}`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-lg font-semibold">
              {formatDealAmount(deal.amountCents)}
            </span>
            <Badge tone="neutral">{DEAL_STATUS_LABELS[deal.status]}</Badge>
          </div>
        </div>
        <Link
          href={`/listings/${deal.listingId}`}
          className="mt-4 inline-block text-sm text-muted underline underline-offset-2"
        >
          View listing
        </Link>
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-semibold">
          History
        </h2>
        <ol className="mt-4 flex flex-col gap-3">
          {deal.history.map((event) => (
            <li
              key={event.id}
              className="rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="text-sm font-medium">
                  {DEAL_STATUS_LABELS[event.fromStatus]} →{" "}
                  {DEAL_STATUS_LABELS[event.toStatus]}
                </span>
                <time className="text-xs text-muted">
                  {new Date(event.createdAt).toLocaleString("en-US")}
                </time>
              </div>
              {event.note ? (
                <p className="mt-1 text-sm text-muted">{event.note}</p>
              ) : null}
              {event.actorId ? (
                <p className="mt-1 text-xs text-muted">
                  By {event.actorId === deal.buyerId ? deal.buyerDisplayName : deal.sellerDisplayName}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <PaymentPanel
        dealId={deal.id}
        isBuyer={deal.buyerId === userId}
        dealStatus={deal.status}
        isSale={deal.type === "SALE"}
        amountCents={deal.amountCents}
        escrowExpiresAt={deal.escrowExpiresAt}
      />

      {deal.type === "EXCHANGE" ? (
        <ExchangeConfirmPanel
          dealId={deal.id}
          buyerConfirmedAt={deal.buyerConfirmedAt}
          sellerConfirmedAt={deal.sellerConfirmedAt}
          isBuyer={deal.buyerId === userId}
          dealStatus={deal.status}
        />
      ) : (
        <HandoffPanel
          dealId={deal.id}
          isBuyer={deal.buyerId === userId}
          dealStatus={deal.status}
        />
      )}

      <DealThread dealId={deal.id} />
    </div>
  );
}

export function DealDetailView({ dealId }: { dealId: string }) {
  const { user, status } = useAuth();

  if (status === "loading") {
    return <p className="text-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see this deal"
        description="Only the buyer and seller of a deal can view its history."
      />
    );
  }

  return <DealDetail dealId={dealId} userId={user.id} />;
}
