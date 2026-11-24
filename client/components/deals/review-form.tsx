"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { ApiError } from "@/lib/api";
import { createReview, fetchMyReview } from "@/lib/reviews-api";

/** Review form shown to participants of a completed deal. */
export function ReviewForm({
  dealId,
  dealStatus,
}: {
  dealId: string;
  dealStatus: string;
}) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const existing = useQuery({
    queryKey: ["my-review", dealId],
    queryFn: () => fetchMyReview(dealId),
    enabled: dealStatus === "COMPLETED",
  });

  const mutation = useMutation({
    mutationFn: () =>
      createReview({
        dealId,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-review", dealId] });
      queryClient.invalidateQueries({ queryKey: ["trust"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      setDone(true);
      setError(null);
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : "Could not save your review.",
      ),
  });

  if (dealStatus !== "COMPLETED") {
    return null;
  }

  if (done || existing.data) {
    return (
      <section className="rounded-lg border border-success/30 bg-success/5 p-6">
        <h2 className="text-lg font-semibold">Thanks for your review</h2>
        <p className="mt-1 text-sm text-muted">
          Your feedback helps other members trade with confidence.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="text-lg font-semibold">Rate this deal</h2>
      <p className="mt-1 text-sm text-muted">
        How was your experience with the other member?
      </p>

      {error ? (
        <Alert tone="danger" title="Could not save your review">
          {error}
        </Alert>
      ) : null}

      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <fieldset>
          <legend className="text-sm font-medium">Rating</legend>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                aria-label={`${value} star${value > 1 ? "s" : ""}`}
                aria-pressed={value === rating}
                onClick={() => setRating(value)}
                className={`text-2xl ${value <= rating ? "text-warning" : "text-muted"}`}
              >
                ★
              </button>
            ))}
          </div>
        </fieldset>
        <TextArea
          label="Comment (optional)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="What went well?"
        />
        <div>
          <Button type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            Submit review
          </Button>
        </div>
      </form>
    </section>
  );
}
