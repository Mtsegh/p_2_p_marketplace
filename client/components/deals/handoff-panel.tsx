"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { completeHandoff, revealHandoffCode } from "@/lib/deals-api";

/**
 * Handoff panel on the deal detail page. The buyer reveals a one-time code;
 * the seller enters it to complete the deal and release funds. Only shown
 * while funds are secured (PAYMENT_PENDING).
 */
export function HandoffPanel({
  dealId,
  isBuyer,
  dealStatus,
}: {
  dealId: string;
  isBuyer: boolean;
  dealStatus: string;
}) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reveal = useMutation({
    mutationFn: () => revealHandoffCode(dealId),
    onSuccess: (result) => {
      setRevealed(result.code);
      setError(null);
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : "Could not reveal the code.",
      ),
  });

  const complete = useMutation({
    mutationFn: () => completeHandoff(dealId, code),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["deal", dealId] });
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not complete the handoff.",
      ),
  });

  if (dealStatus !== "PAYMENT_PENDING") {
    return null;
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Handoff</h2>
      <p className="mt-1 text-sm text-muted">
        {isBuyer
          ? "Reveal this code to the seller when you meet and have inspected the item."
          : "Enter the code the buyer gives you after inspecting the item."}
      </p>

      {error ? (
        <Alert tone="danger" title="Handoff error">
          {error}
        </Alert>
      ) : null}

      {isBuyer ? (
        <div className="mt-4">
          {revealed ? (
            <div className="rounded-md border border-line bg-surface-raised p-4 text-center">
              <p className="text-xs text-muted">Your one-time code</p>
              <p className="mt-1 font-mono text-3xl font-semibold tracking-widest">
                {revealed}
              </p>
              <p className="mt-2 text-xs text-warning">
                Keep this private until you have inspected the item.
              </p>
            </div>
          ) : null}
          <Button
            className="mt-3"
            onClick={() => reveal.mutate()}
            loading={reveal.isPending}
            disabled={reveal.isPending}
          >
            {revealed ? "New code" : "Reveal handoff code"}
          </Button>
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) complete.mutate();
          }}
        >
          <TextField
            label="Handoff code"
            placeholder="482 915"
            inputMode="numeric"
            maxLength={7}
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          <div>
            <Button
              type="submit"
              loading={complete.isPending}
              disabled={!code.trim() || complete.isPending}
            >
              Complete deal
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
