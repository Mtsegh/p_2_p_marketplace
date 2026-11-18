"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { verifyEmailToken } from "@/lib/auth-api";

type State =
  | { status: "working" }
  | { status: "done" }
  | { status: "error"; message: string };

const MISSING_TOKEN =
  "This link is missing its token. Open the link from your email again, or resend it from your profile.";

/**
 * Confirms the address once on mount. The link carries the token in the query
 * string because email can only be a URL, but the API receives it in a POST
 * body, so mail scanners that prefetch links cannot spend it.
 */
export function VerifyEmailView({ token }: { token?: string }) {
  const { syncUser } = useAuth();
  const [state, setState] = useState<State>(
    token ? { status: "working" } : { status: "error", message: MISSING_TOKEN },
  );
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) {
      return;
    }

    started.current = true;

    verifyEmailToken(token)
      .then((user) => {
        syncUser(user);
        setState({ status: "done" });
      })
      .catch((error: unknown) => {
        setState({
          status: "error",
          message:
            error instanceof ApiError
              ? error.message
              : "Something went wrong. Check your connection and try the link again.",
        });
      });
  }, [token, syncUser]);

  if (state.status === "working") {
    return (
      <div role="status" className="max-w-md">
        <span className="sr-only">Confirming your email address</span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-4 h-24 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <Alert tone="danger" title="That link did not work">
          {state.message}
        </Alert>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/login">Sign in</ButtonLink>
          <ButtonLink href="/profile" variant="secondary">
            Go to profile
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Alert tone="success" title="Email confirmed">
        Your address is confirmed. You can list items, make proposals, and
        receive deal updates.
      </Alert>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/profile">Go to profile</ButtonLink>
        <Link
          href="/browse"
          className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium underline underline-offset-4"
        >
          Browse listings
        </Link>
      </div>
    </div>
  );
}
