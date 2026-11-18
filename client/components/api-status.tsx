"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { fetchHealth, type HealthReport } from "@/lib/api";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "success"; report: HealthReport };

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

function DependencyRow({
  label,
  status,
}: {
  label: string;
  status: "up" | "down";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-surface-raised px-3 py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{status === "up" ? "Up" : "Down"}</dd>
    </div>
  );
}

export function ApiStatus() {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    let active = true;

    fetchHealth(controller.signal)
      .then((report) => {
        if (active) {
          setState({ kind: "success", report });
        }
      })
      .catch(() => {
        if (active) {
          setState({ kind: "error" });
        }
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  function refresh(): void {
    setState({ kind: "loading" });
    setAttempt((value) => value + 1);
  }

  return (
    <section
      aria-labelledby="api-status-heading"
      className="rounded-lg border border-line bg-surface p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="api-status-heading" className="text-base font-semibold">
            API status
          </h2>
          <p className="mt-1 text-sm text-muted">
            Live check of the marketplace API and its dependencies.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={refresh}
          loading={state.kind === "loading"}
          disabled={state.kind === "loading"}
        >
          Check again
        </Button>
      </div>

      <div className="mt-4">
        {state.kind === "loading" ? (
          <div role="status">
            <span className="sr-only">Checking API status</span>
            <Skeleton className="h-4 w-48" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : null}

        {state.kind === "error" ? (
          <Alert tone="danger" title="The API is not responding">
            Start the API from <code className="font-mono">server/</code> with{" "}
            <code className="font-mono">npm run dev</code>, then check again.
          </Alert>
        ) : null}

        {state.kind === "success" ? (
          <div role="status">
            <p className="flex items-center gap-2 text-sm font-medium">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 rounded-full",
                  state.report.status === "ok" ? "bg-success" : "bg-warning",
                )}
              />
              {state.report.status === "ok"
                ? "All systems operational"
                : "Some services are unavailable"}
            </p>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <DependencyRow
                label="Database"
                status={state.report.checks.database}
              />
              <DependencyRow label="Cache" status={state.report.checks.redis} />
            </dl>
            <p className="mt-3 text-xs text-muted">
              Last checked{" "}
              {new Date(state.report.timestamp).toLocaleTimeString(
                [],
                TIME_FORMAT,
              )}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
