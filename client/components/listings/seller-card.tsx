import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { displayNameOf, initialsForUser } from "@/lib/profile-display";
import type { PublicProfile } from "@/lib/profiles-api";

/**
 * Seller trust card on the listing detail page. Shows only what the public
 * profile API exposes — never an email address — plus the two verification
 * badges that signal a trustworthy member.
 */
export function SellerCard({ profile }: { profile: PublicProfile }) {
  return (
    <section
      aria-labelledby="seller-heading"
      className="rounded-lg border border-line bg-surface p-6"
    >
      <h2 id="seller-heading" className="text-lg font-semibold">
        Seller
      </h2>
      <div className="mt-4 flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-surface-raised text-lg font-semibold"
        >
          {initialsForUser(profile)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{displayNameOf(profile)}</p>
          <p className="truncate text-sm text-muted">
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

      <p className="mt-4 text-xs text-muted">
        Member since{" "}
        {new Intl.DateTimeFormat("en-US", {
          dateStyle: "medium",
        }).format(new Date(profile.memberSince))}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <ButtonLink href={`/users/${profile.id}`} variant="secondary" size="sm">
          View profile
        </ButtonLink>
      </div>

      {profile.bio ? (
        <p className="mt-4 whitespace-pre-line text-sm text-muted">
          {profile.bio}
        </p>
      ) : null}
    </section>
  );
}
