"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { fetchPayoutStatus, onboardPayout } from "@/lib/payments-api";

/** Seller payout onboarding, shown in account settings. */
export function PayoutSettings() {
  const queryClient = useQueryClient();
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["payout-status"],
    queryFn: fetchPayoutStatus,
  });

  const mutation = useMutation({
    mutationFn: () => onboardPayout(country),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout-status"] });
      setError(null);
    },
    onError: (caught) => {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not complete onboarding.",
      );
    },
  });

  if (status.isLoading) {
    return <p className="text-sm text-muted">Loading payout status…</p>;
  }

  const onboarded = Boolean(status.data?.onboarded);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Badge tone={onboarded ? "success" : "warning"}>
          {onboarded ? "Onboarded" : "Not onboarded"}
        </Badge>
        <span className="text-sm text-muted">
          {onboarded
            ? "You can receive payouts from paid deals."
            : "Complete onboarding to accept paid deals."}
        </span>
      </div>

      {error ? (
        <Alert tone="danger" title="Could not complete onboarding">
          {error}
        </Alert>
      ) : null}

      {!onboarded ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (country.trim().length === 2) mutation.mutate();
          }}
        >
          <TextField
            label="Country code"
            placeholder="US"
            maxLength={2}
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase())}
            hint="Two-letter country code for your payout account."
          />
          <div>
            <Button
              type="submit"
              size="sm"
              loading={mutation.isPending}
              disabled={country.trim().length !== 2 || mutation.isPending}
            >
              Set up payouts
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
