"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { createReport } from "@/lib/reports-api";

/** Report control for a listing or member. Hidden from signed-out users. */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "listing" | "user";
  targetId: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createReport({ targetType, targetId, reason: reason.trim() }),
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      setError(null);
    },
    onError: (caught) =>
      setError(
        caught instanceof ApiError ? caught.message : "Could not send your report.",
      ),
  });

  if (!user || user.id === targetId) {
    return null;
  }

  if (done) {
    return (
      <p className="text-xs text-muted" role="status">
        Thanks. An admin will review this report.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
      >
        Report {targetType}
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-line p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim().length >= 10) mutation.mutate();
      }}
    >
      {error ? (
        <Alert tone="danger" title="Could not send your report">
          {error}
        </Alert>
      ) : null}
      <TextArea
        label={`Report this ${targetType}`}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        hint="Describe the problem. At least 10 characters."
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          size="sm"
          variant="danger"
          loading={mutation.isPending}
          disabled={reason.trim().length < 10 || mutation.isPending}
        >
          Submit report
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
