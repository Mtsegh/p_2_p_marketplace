import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { displayNameOf, initialsForUser } from "@/lib/profile-display";
import { fetchPublicProfile } from "@/lib/profiles-api";

type PageProps = { params: Promise<{ userId: string }> };

/**
 * Public profiles are public: no session is needed, and the API only returns
 * the fields a stranger may see. The id is only known at request time, so this
 * segment opts out of instant-navigation validation: a first visit waits for
 * the profile rather than showing a shell with nothing in it. `cache` shares
 * one request between the page and its metadata instead of asking twice.
 */
export const instant = false;

const loadProfile = cache(async (userId: string) => {
  try {
    return await fetchPublicProfile(userId);
  } catch (error) {
    // An unknown id, a malformed id, a suspended account, and a deleted
    // account all look the same to a visitor.
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 422)
    ) {
      notFound();
    }

    throw error;
  }
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { userId } = await params;

  try {
    const profile = await loadProfile(userId);
    return { title: displayNameOf(profile) };
  } catch {
    return { title: "Member profile" };
  }
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { userId } = await params;
  const profile = await loadProfile(userId);

  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <section
          aria-labelledby="member-heading"
          className="rounded-lg border border-line bg-surface p-6"
        >
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden="true"
              className="flex size-16 items-center justify-center rounded-full bg-surface-raised text-2xl font-semibold"
            >
              {initialsForUser(profile)}
            </span>
            <div className="min-w-0">
              <h1
                id="member-heading"
                className="text-2xl font-semibold tracking-tight"
              >
                {displayNameOf(profile)}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {profile.location || "Location not shared"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {profile.emailVerified ? (
              <Badge tone="success">Email verified</Badge>
            ) : (
              <Badge tone="outline">Email not verified</Badge>
            )}
            {profile.phoneVerified ? (
              <Badge tone="success">Phone verified</Badge>
            ) : (
              <Badge tone="outline">Phone not verified</Badge>
            )}
          </div>

          <p className="mt-6 text-sm text-muted">
            Member since{" "}
            {new Intl.DateTimeFormat(undefined, {
              dateStyle: "medium",
            }).format(new Date(profile.memberSince))}
          </p>
        </section>

        <section aria-labelledby="about-heading">
          <h2 id="about-heading" className="text-lg font-semibold">
            About
          </h2>
          {profile.bio ? (
            <p className="mt-2 whitespace-pre-line text-foreground">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-2 text-muted">
              This member has not written a public bio yet.
            </p>
          )}
        </section>

        <div>
          <ButtonLink href="/browse" variant="secondary">
            Browse listings
          </ButtonLink>
        </div>
      </div>
    </PageContainer>
  );
}
