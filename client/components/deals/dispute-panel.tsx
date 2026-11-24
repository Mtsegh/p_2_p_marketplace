"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { ApiError } from "@/lib/api";
import { fetchDealDispute, openDispute } from "@/lib/disputes-api";

/** Lets a deal participant raise a dispute while funds are secured. */
export function DisputePanel({
  dealId,
  dealStatus,
}: {
  dealId: string;
  dealStatus: string;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disputeQuery = useQuery({
    queryKey: ["deal-dispute", dealId],
    queryFn: () => fetchDealDispute(dealId),
    enabled: dealStatus === "PAYMENT_PENDING" || dealStatus === "DISPUTED",
  });

  const mutation = useMutation({
    mutationFn: () => openDispute(dealId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal-dispute", dealId] });
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
      setConfirming(false);
      setError(null);
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : "Could not open a dispute.",
      ),
  });

  if (dealStatus !== "PAYMENT_PENDING" && dealStatus !== "DISPUTED") {
    return null;
  }

  const dispute = disputeQuery.data;

  if (dispute) {
    return (
      <section className="rounded-lg border border-danger/30 bg-danger/5 p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Dispute</h2>
          <Badge tone={dispute.status === "OPEN" ? "warning" : "success"}>
            {dispute.status}
          </Badge>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm text-muted">
          {dispute.reason}
        </p>
        {dispute.resolution ? (
          <p className="mt-2 text-sm">
            Resolution: <strong>{dispute.resolution}</strong>
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">
            Funds are frozen while an admin reviews this dispute.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Something went wrong?</h2>
      <p className="mt-1 text-sm text-muted">
        If the handoff cannot be resolved, open a dispute. An admin will review
        it and decide how the secured funds are handled.
      </p>

      {error ? (
        <Alert tone="danger" title="Could not open a dispute">
          {error}
        </Alert>
      ) : null}

      {confirming ? (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (reason.trim().length >= 10) mutation.mutate();
          }}
        >
          <TextArea
            label="What happened?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            hint="At least 10 characters. Include anything that helps an admin decide."
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="danger"
              loading={mutation.isPending}
              disabled={reason.trim().length < 10 || mutation.isPending}
            >
              Submit dispute
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => setConfirming(true)}
        >
          Open a dispute
        </Button>
      )}
    </section>
  );
}
