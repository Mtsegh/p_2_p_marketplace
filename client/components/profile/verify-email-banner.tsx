"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { resendVerificationEmail } from "@/lib/auth-api";

type State = "idle" | "sending" | "sent";

/**
 * Shown while the address is unconfirmed. Confirming unlocks listings and
 * deals, so the banner explains what is blocked and offers the resend instead
 * of leaving the user to find it.
 */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  if (!user || user.emailVerified) {
    return null;
  }

  async function handleResend(): Promise<void> {
    setState("sending");
    setError(null);

    try {
      await resendVerificationEmail();
      setState("sent");
    } catch (caught) {
      setState("idle");
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not send the email. Check your connection and try again.",
      );
    }
  }

  return (
    <Alert tone="warning" title="Confirm your email address">
      <p>
        We sent a link to <span className="font-medium">{user.email}</span>.
        Confirm it to list items and make proposals.
      </p>

      {state === "sent" ? (
        <p className="mt-2" role="status">
          Sent again. Check your inbox and spam folder.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        variant="secondary"
        size="sm"
        className="mt-4"
        onClick={handleResend}
        loading={state === "sending"}
      >
        Resend email
      </Button>
    </Alert>
  );
}
