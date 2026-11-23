"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { confirmExchangeHandoff } from "@/lib/deals-api";

/**
 * Dual-lock confirmation panel for exchange deals. Each party confirms once;
 * the deal completes only after both have confirmed. Shows the current state
 * of each side's confirmation.
 */
export function ExchangeConfirmPanel({
  dealId,
  buyerConfirmedAt,
  sellerConfirmedAt,
  isBuyer,
  dealStatus,
}: {
  dealId: string;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  isBuyer: boolean;
  dealStatus: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => confirmExchangeHandoff(dealId),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not confirm the handoff.",
      ),
  });

  const mineConfirmed = isBuyer ? buyerConfirmedAt : sellerConfirmedAt;
  const otherConfirmed = isBuyer ? sellerConfirmedAt : buyerConfirmedAt;

  if (dealStatus !== "PAYMENT_PENDING") {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Confirm the swap</h2>
      <p className="mt-1 text-sm text-muted">
        Both sides must confirm they have handed over their items before the
        deal completes.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={mineConfirmed ? "success" : "warning"}>
          You: {mineConfirmed ? "Confirmed" : "Not confirmed"}
        </Badge>
        <Badge tone={otherConfirmed ? "success" : "warning"}>
          Other party: {otherConfirmed ? "Confirmed" : "Waiting"}
        </Badge>
      </div>

      {error ? (
        <Alert tone="danger" title="Could not confirm">
          {error}
        </Alert>
      ) : null}

      <div className="mt-4">
        {mineConfirmed ? (
          <p className="text-sm text-muted">
            You confirmed. Waiting for the other party.
          </p>
        ) : (
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={mutation.isPending}
          >
            I handed over my item
          </Button>
        )}
      </div>
    </section>
  );
}
