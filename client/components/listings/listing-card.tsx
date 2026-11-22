import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  formatPrice,
  listingTypeLabel,
  primaryImage,
} from "@/lib/listing-display";
import type { Listing } from "@/lib/listings-api";

const conditionLabels: Record<Listing["condition"], string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

/**
 * A single listing in the browse grid. Server-compatible (no hooks) so it can
 * be rendered during the first paint of the public browse page.
 */
export function ListingCard({ listing }: { listing: Listing }) {
  const image = primaryImage(listing.images);
  const price = formatPrice(listing.priceCents);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-colors hover:border-foreground/40"
      aria-label={`${listing.title}, ${listingTypeLabel(listing.listingType)}${price ? `, ${price}` : ""}`}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-raised">
        {image ? (
          // Image host comes from runtime S3/CDN config, so next/image cannot
          // be given a config-time remotePattern here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={listing.title}
            className="size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted">
            No image
          </div>
        )}
        <div className="absolute left-2 top-2">
          <Badge tone="info">{listingTypeLabel(listing.listingType)}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="line-clamp-2 font-medium leading-snug">
          {listing.title}
        </h3>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{price ?? "Swap only"}</span>
          <span className="text-xs text-muted">
            {conditionLabels[listing.condition]}
          </span>
        </div>
        <p className="truncate text-xs text-muted">{listing.location}</p>
      </div>
    </Link>
  );
}
