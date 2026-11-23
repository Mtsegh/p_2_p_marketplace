"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fetchMyListings, type Listing } from "@/lib/listings-api";
import { createExchangeProposal } from "@/lib/deals-api";

const schema = z
  .object({
    offeredListingIds: z
      .array(z.string().uuid())
      .min(1, "Offer at least one of your listings"),
    topUpCents: z
      .number()
      .int()
      .min(0, "Top-up must be zero or more")
      .optional(),
  });

type FormValues = z.infer<typeof schema>;

/**
 * Exchange offer form: the buyer picks one or more of their own active listings
 * to offer in return, with an optional cash top-up. Only shown to signed-in
 * non-owners on listings that accept exchanges.
 */
export function ExchangeProposalForm({
  listingId,
  ownerId,
  listingType,
}: {
  listingId: string;
  ownerId: string;
  listingType: "SALE" | "EXCHANGE" | "BOTH";
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [mine, setMine] = useState<Listing[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { offeredListingIds: [], topUpCents: 0 },
  });

  if (!user || user.id === ownerId || listingType === "SALE") {
    return null;
  }

  async function loadMyListings() {
    try {
      const result = await fetchMyListings();
      // Only active listings can be offered in a swap.
      setMine(result.listings.filter((listing) => listing.status === "ACTIVE"));
    } catch {
      setFormError("Could not load your listings.");
    }
  }

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);

    try {
      const deal = await createExchangeProposal({
        listingId,
        offeredListingIds: selected,
        topUpCents: values.topUpCents ?? 0,
      });
      router.push(`/deals/${deal.id}`);
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  function setError(caught: unknown) {
    if (caught instanceof ApiError) {
      setFormError(caught.message);
      return;
    }
    setFormError("Something went wrong. Check your connection and try again.");
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <h3 className="font-medium">Propose a swap</h3>
      <p className="mt-1 text-sm text-muted">
        Offer one or more of your active listings in exchange.
      </p>

      {formError ? (
        <Alert tone="danger" title="Could not send your swap offer">
          {formError}
        </Alert>
      ) : null}

      {mine === null ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-3"
          onClick={loadMyListings}
        >
          Choose my listings
        </Button>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="mt-3 flex flex-col gap-3">
          {mine.length === 0 ? (
            <p className="text-sm text-muted">
              You have no active listings to offer. Create one first.
            </p>
          ) : (
            <fieldset>
              <legend className="sr-only">Your listings to offer</legend>
              <div className="flex flex-col gap-2">
                {mine.map((listing) => (
                  <label key={listing.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.includes(listing.id)}
                      onChange={() => toggle(listing.id)}
                    />
                    {listing.title}
                  </label>
                ))}
              </div>
              {errors.offeredListingIds ? (
                <p className="mt-1 text-xs text-danger">
                  {errors.offeredListingIds.message}
                </p>
              ) : null}
            </fieldset>
          )}

          <TextField
            label="Cash top-up (cents, optional)"
            type="number"
            min="0"
            step="1"
            placeholder="0"
            error={errors.topUpCents?.message}
            {...register("topUpCents")}
          />

          <Button
            type="submit"
            size="sm"
            loading={submitting}
            disabled={submitting || selected.length === 0}
          >
            Send swap offer
          </Button>
        </form>
      )}
    </div>
  );
}
