"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

function AccountCard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return null;
  }

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);

    try {
      await logout();
    } finally {
      setSigningOut(false);
      router.replace("/");
    }
  }

  return (
    <section
      aria-labelledby="account-heading"
      className="rounded-lg border border-line bg-surface p-6"
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-surface-raised text-xl font-semibold"
        >
          {user.email.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h2 id="account-heading" className="break-all text-lg font-semibold">
            {user.email}
          </h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={user.role === "ADMIN" ? "info" : "outline"}>
              {user.role === "ADMIN" ? "Administrator" : "Member"}
            </Badge>
            {user.emailVerified ? (
              <Badge tone="success">Email verified</Badge>
            ) : (
              <Badge tone="warning">Email not verified</Badge>
            )}
            {user.phoneVerified ? (
              <Badge tone="success">Phone verified</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Member since</dt>
          <dd className="mt-1 font-medium">
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
            }).format(new Date(user.createdAt))}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Phone</dt>
          <dd className="mt-1 font-medium">
            {user.phoneVerified ? "Verified" : "Not verified"}
          </dd>
        </div>
      </dl>

      {!user.emailVerified ? (
        <p className="mt-6 text-sm text-muted">
          This address is not confirmed yet. Email verification and account
          recovery arrive in a later release.
        </p>
      ) : null}

      <div className="mt-6">
        <Button
          variant="secondary"
          onClick={handleSignOut}
          loading={signingOut}
        >
          Sign out
        </Button>
      </div>
    </section>
  );
}

export function ProfileView() {
  const { user, status } = useAuth();

  if (status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Loading your account</span>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your profile"
        description="Your account, deals, and listings live here once you are signed in."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/login">Sign in</ButtonLink>
            <ButtonLink href="/register" variant="secondary">
              Create account
            </ButtonLink>
          </div>
        }
      />
    );
  }

  return <AccountCard />;
}
