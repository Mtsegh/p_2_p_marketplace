"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  createCheckout,
  fetchTransaction,
  formatMoney,
  type TransactionStatus,
} from "@/lib/payments-api";

const STATUS_TONE: Record<TransactionStatus, "warning" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  REFUNDED: "neutral",
};

/**
 * Payment panel shown to the buyer of an accepted sale deal. Starts hosted
 * checkout and reflects the transaction status (webhook-driven).
 */
export function PaymentPanel({
  dealId,
  isBuyer,
  dealStatus,
  isSale,
  amountCents,
  escrowExpiresAt,
}: {
  dealId: string;
  isBuyer: boolean;
  dealStatus: string;
  isSale: boolean;
  amountCents: number | null;
  escrowExpiresAt: string | null;
}) {
  const queryClient = useQueryClient();

  const txQuery = useQuery({
    queryKey: ["transaction", dealId],
    queryFn: () => fetchTransaction(dealId),
    enabled: isBuyer && isSale,
  });

  const checkout = useMutation({
    mutationFn: () => createCheckout(dealId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction", dealId] });
    },
  });

  // Once funds are secured, both buyer and seller see the escrow status.
  const fundsSecured = dealStatus === "PAYMENT_PENDING" && escrowExpiresAt !== null;

  if (!isSale || amountCents === null) {
    return null;
  }

  if (fundsSecured) {
    return (
      <section className="rounded-lg border border-success/30 bg-success/5 p-6">
        <h2 className="text-lg font-semibold">Funds secured</h2>
        <p className="mt-2 text-sm text-muted">
          {formatMoney(amountCents)} is held safely by the marketplace. The
          seller can proceed with the handoff.
        </p>
        <p className="mt-1 text-xs text-muted">
          Funds are returned to the buyer automatically on{" "}
          {new Date(escrowExpiresAt!).toLocaleDateString("en-US")} if the deal
          is not completed.
        </p>
      </section>
    );
  }

  if (!isBuyer) {
    return null;
  }

  const tx = txQuery.data;

  if (tx && tx.status !== "FAILED") {
    return (
      <section className="rounded-lg border border-line bg-surface p-6">
        <h2 className="text-lg font-semibold">Payment</h2>
        <div className="mt-3 flex items-center gap-3">
          <Badge tone={STATUS_TONE[tx.status]}>{tx.status}</Badge>
          <span className="text-sm text-muted">{formatMoney(tx.amountCents, tx.currency)}</span>
        </div>
        {tx.status === "PENDING" ? (
          <p className="mt-2 text-sm text-muted">
            Your payment is being processed. This page updates automatically.
          </p>
        ) : null}
      </section>
    );
  }

  if (dealStatus !== "ACCEPTED") {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Payment</h2>
      <p className="mt-1 text-sm text-muted">
        Pay {formatMoney(amountCents)} to secure this deal.
      </p>
      {checkout.isError ? (
        <Alert tone="danger" title="Could not start checkout">
          {checkout.error instanceof ApiError
            ? checkout.error.message
            : "Check your connection and try again."}
        </Alert>
      ) : null}
      <div className="mt-4">
        <Button
          onClick={() => checkout.mutate()}
          loading={checkout.isPending}
          disabled={checkout.isPending}
        >
          Pay {formatMoney(amountCents)}
        </Button>
      </div>
    </section>
  );
}
