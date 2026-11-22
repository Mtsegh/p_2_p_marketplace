"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  acceptDeal,
  cancelDeal,
  DEAL_STATUS_LABELS,
  formatDealAmount,
  rejectDeal,
  type Deal,
  type DealStatus,
} from "@/lib/deals-api";

const STATUS_TONE: Record<DealStatus, BadgeTone> = {
  PROPOSED: "warning",
  ACCEPTED: "success",
  REJECTED: "danger",
  CANCELLED: "neutral",
  PAYMENT_PENDING: "info",
  COMPLETED: "success",
  DISPUTED: "danger",
  RESOLVED: "info",
};

/**
 * A single deal in the list. Shows the counterparty, listing, status, price,
 * and the state-machine actions available to the current user.
 */
export function DealCard({
  deal,
  onChanged,
}: {
  deal: Deal;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return null;
  }

  const isSeller = deal.sellerId === user.id;
  const isBuyer = deal.buyerId === user.id;

  async function act(action: () => Promise<Deal>) {
    setBusy(true);
    setError(null);

    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-lg border border-line bg-surface p-5">
      {error ? <Alert tone="danger" title="Action failed">{error}</Alert> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/listings/${deal.listingId}`}
            className="font-medium hover:underline"
          >
            {deal.listingTitle}
          </Link>
          <p className="mt-1 text-sm text-muted">
            {isBuyer
              ? `Seller: ${deal.sellerDisplayName}`
              : `Buyer: ${deal.buyerDisplayName}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="font-semibold">{formatDealAmount(deal.amountCents)}</span>
          <Badge tone={STATUS_TONE[deal.status]}>
            {DEAL_STATUS_LABELS[deal.status]}
          </Badge>
        </div>
      </div>

      {deal.status === "PROPOSED" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {isSeller ? (
            <>
              <Button
                size="sm"
                loading={busy}
                disabled={busy}
                onClick={() => act(() => acceptDeal(deal.id))}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busy}
                disabled={busy}
                onClick={() => act(() => rejectDeal(deal.id))}
              >
                Reject
              </Button>
            </>
          ) : null}
          {isBuyer ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy}
              disabled={busy}
              onClick={() => act(() => cancelDeal(deal.id))}
            >
              Cancel proposal
            </Button>
          ) : null}
        </div>
      ) : null}

      <Link
        href={`/deals/${deal.id}`}
        className="mt-4 inline-block text-sm text-muted underline underline-offset-2 hover:text-foreground"
      >
        View history
      </Link>
    </article>
  );
}
