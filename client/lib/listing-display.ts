import type { ListingCondition, ListingType } from "./listings-api";

/**
 * Presentation helpers shared by the browse grid and the listing detail page.
 * Amounts are stored as integer cents; there is no currency field on a listing
 * yet, so the marketplace currently prices everything in USD.
 */

export function formatPrice(cents: number | null): string | null {
  if (cents === null) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Sale, Swap, or Sale or Swap — a single consistent label everywhere. */
export function listingTypeLabel(type: ListingType): string {
  switch (type) {
    case "SALE":
      return "Sale";
    case "EXCHANGE":
      return "Swap";
    case "BOTH":
      return "Sale or Swap";
  }
}

const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

export function conditionLabel(condition: ListingCondition): string {
  return CONDITION_LABELS[condition];
}

/** The first image by position, used as the card thumbnail and detail hero. */
export function primaryImage<T extends { position: number }>(
  images: T[],
): T | undefined {
  return [...images].sort((a, b) => a.position - b.position)[0];
}
