"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { displayNameOf, initialsForUser } from "@/lib/profile-display";
import { AccountData } from "./account-data";
import { ChangeEmailForm } from "./change-email-form";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";
import { PhoneVerificationForm } from "./phone-verification-form";
import { VerifyEmailBanner } from "./verify-email-banner";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-lg border border-line bg-surface p-6"
    >
      <h2 id={id} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AccountSummary() {
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
          className="flex size-16 items-center justify-center rounded-full bg-surface-raised text-2xl font-semibold"
        >
          {initialsForUser(user)}
        </span>
        <div className="min-w-0">
          <h2 id="account-heading" className="text-lg font-semibold">
            {displayNameOf(user)}
          </h2>
          <p className="break-all text-sm text-muted">{user.email}</p>
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
          <dt className="text-muted">Location</dt>
          <dd className="mt-1 font-medium">{user.location || "Not set"}</dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href={`/users/${user.id}`} variant="secondary">
          View public profile
        </ButtonLink>
        <Button variant="ghost" onClick={handleSignOut} loading={signingOut}>
          Sign out
        </Button>
      </div>
    </section>
  );
}

export function ProfileView() {
  const { user, status } = useAuth();
  const [deleted, setDeleted] = useState(false);

  if (deleted) {
    return (
      <div className="flex max-w-lg flex-col gap-4">
        <Alert tone="success" title="Account deleted">
          Your personal details are gone and every device is signed out. If you
          come back later, you will need to create a new account.
        </Alert>
        <div>
          <ButtonLink href="/">Back to the marketplace</ButtonLink>
        </div>
      </div>
    );
  }

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

  return (
    <div className="flex flex-col gap-6">
      <VerifyEmailBanner />
      <AccountSummary />

      <Section
        id="public-profile-heading"
        title="Public profile"
        description="What other members see on your listings and proposals. Your email address is never shown."
      >
        <ProfileForm />
      </Section>

      <Section
        id="security-heading"
        title="Sign in and security"
        description="Change your password or the address you use to sign in."
      >
        <div className="flex flex-col gap-8">
          <div>
            <h3 className="font-medium">Password</h3>
            <p className="mt-1 text-sm text-muted">
              Changing it signs out every other device.
            </p>
            <div className="mt-4">
              <ChangePasswordForm />
            </div>
          </div>

          <div className="border-t border-line pt-6">
            <h3 className="font-medium">Email address</h3>
            <p className="mt-1 text-sm text-muted">
              We send a confirmation link to the new address before the change
              takes effect.
            </p>
            <div className="mt-4">
              <ChangeEmailForm />
            </div>
          </div>

          <div className="border-t border-line pt-6">
            <h3 className="font-medium">Phone number</h3>
            <p className="mt-1 text-sm text-muted">
              Verifying your phone adds a badge to your public profile so other
              members can see it is confirmed.
            </p>
            <div className="mt-4">
              <PhoneVerificationForm />
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="data-heading"
        title="Your data"
        description="Take a copy of your account, or close it for good."
      >
        <AccountData onDeleted={() => setDeleted(true)} />
      </Section>
    </div>
  );
}
