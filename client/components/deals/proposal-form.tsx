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
import { createProposal } from "@/lib/deals-api";

const schema = z.object({
  amountCents: z
    .number()
    .int()
    .min(1, "Enter an offer amount in cents")
    .max(10_000_000_00, "Offer is too high"),
});

type FormValues = z.infer<typeof schema>;

/**
 * Sale proposal form shown on a listing's detail page. Hidden for the listing
 * owner and for exchange-only listings. On success it navigates to the deal
 * detail page where the buyer can watch for a response.
 */
export function ProposalForm({
  listingId,
  ownerId,
  listingType,
  askCents,
}: {
  listingId: string;
  ownerId: string;
  listingType: "SALE" | "EXCHANGE" | "BOTH";
  askCents: number | null;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amountCents: askCents ?? undefined,
    },
  });

  if (!user || user.id === ownerId || listingType === "EXCHANGE") {
    return null;
  }

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitting(true);

    try {
      const deal = await createProposal({
        listingId,
        amountCents: values.amountCents,
      });
      router.push(`/deals/${deal.id}`);
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  function setError(caught: unknown) {
    if (caught instanceof ApiError) {
      if (caught.code === "PROPOSAL_EXISTS") {
        setFormError("You already have a pending offer on this listing.");
        return;
      }
      if (caught.code === "EMAIL_NOT_VERIFIED") {
        setFormError("Confirm your email address before making an offer.");
        return;
      }
      setFormError(caught.message);
      return;
    }

    setFormError("Something went wrong. Check your connection and try again.");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
      {formError ? (
        <Alert tone="danger" title="Could not send your offer">
          {formError}
        </Alert>
      ) : null}
      <TextField
        label="Your offer (cents)"
        type="number"
        inputMode="numeric"
        min="1"
        step="1"
        placeholder="9000"
        hint="The amount you are offering, in whole cents."
        error={errors.amountCents?.message}
        {...register("amountCents")}
      />
      <Button type="submit" size="lg" loading={submitting} disabled={submitting}>
        Make an offer
      </Button>
    </form>
  );
}
