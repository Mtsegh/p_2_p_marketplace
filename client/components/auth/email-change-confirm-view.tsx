"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { confirmEmailChange } from "@/lib/auth-api";

type State =
  | { status: "working" }
  | { status: "done"; email: string }
  | { status: "error"; message: string };

const MISSING_TOKEN =
  "This link is missing its token. Open the link from your email again, or start the change from your profile.";

/**
 * Finishes an email change from the link sent to the new address. The token is
 * the credential, so this works whether or not the browser has a session; when
 * it does, the cached email is updated so the header stops showing the old one.
 */
export function EmailChangeConfirmView({ token }: { token?: string }) {
  const { user, syncUser } = useAuth();
  const [state, setState] = useState<State>(
    token ? { status: "working" } : { status: "error", message: MISSING_TOKEN },
  );
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) {
      return;
    }

    started.current = true;

    confirmEmailChange(token)
      .then((result) => {
        if (user && user.id === result.userId) {
          syncUser({ ...user, email: result.email, emailVerified: true });
        }

        setState({ status: "done", email: result.email });
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
  }, [token, user, syncUser]);

  if (state.status === "working") {
    return (
      <div role="status" className="max-w-md">
        <span className="sr-only">Confirming your new email address</span>
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
          <ButtonLink href="/profile">Go to profile</ButtonLink>
          <ButtonLink href="/login" variant="secondary">
            Sign in
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <Alert tone="success" title="Email address updated">
        You can now sign in with <strong>{state.email}</strong>. Your old
        address no longer works.
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
