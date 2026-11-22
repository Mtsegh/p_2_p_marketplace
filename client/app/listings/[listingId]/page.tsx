import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { ProposalForm } from "@/components/deals/proposal-form";
import { ListingGallery } from "@/components/listings/listing-gallery";
import { ListingCard } from "@/components/listings/listing-card";
import { SellerCard } from "@/components/listings/seller-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";
import {
  conditionLabel,
  formatPrice,
  listingTypeLabel,
  primaryImage,
} from "@/lib/listing-display";
import { fetchListing, fetchListings } from "@/lib/listings-api";
import { fetchPublicProfile, type PublicProfile } from "@/lib/profiles-api";

type PageProps = { params: Promise<{ listingId: string }> };

/**
 * The id is only known at request time, so this segment opts out of
 * instant-navigation validation just like the public profile page. `cache`
 * shares one request between the page and its metadata.
 */
export const instant = false;

const loadListing = cache(async (listingId: string) => {
  try {
    return await fetchListing(listingId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    throw error;
  }
});

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { listingId } = await params;

  try {
    const listing = await loadListing(listingId);
    const image = primaryImage(listing.images);

    return {
      title: listing.title,
      description: `${listing.description.slice(0, 150)}${listing.description.length > 150 ? "…" : ""}`,
      openGraph: {
        title: listing.title,
        description: listing.location,
        type: "website",
        ...(image ? { images: [{ url: image.url }] } : {}),
      },
    };
  } catch {
    return { title: "Listing" };
  }
}

async function loadSeller(ownerId: string): Promise<PublicProfile | null> {
  try {
    return await fetchPublicProfile(ownerId);
  } catch {
    return null;
  }
}

async function SimilarListings({
  categoryId,
  currentId,
}: {
  categoryId: string | null;
  currentId: string;
}) {
  if (!categoryId) {
    return null;
  }

  let similar;

  try {
    similar = await fetchListings({ category: categoryId, limit: 5 });
  } catch {
    return null;
  }

  const items = similar.listings
    .filter((listing) => listing.id !== currentId)
    .slice(0, 4);

  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="similar-heading" className="mt-10">
      <h2 id="similar-heading" className="text-lg font-semibold">
        Similar items
      </h2>
      <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((listing) => (
          <li key={listing.id}>
            <ListingCard listing={listing} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingId } = await params;
  const listing = await loadListing(listingId);
  const seller = await loadSeller(listing.ownerId);

  const price = formatPrice(listing.priceCents);

  return (
    <PageContainer className="py-10 sm:py-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="min-w-0">
          <ListingGallery images={listing.images} title={listing.title} />
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="info">{listingTypeLabel(listing.listingType)}</Badge>
              <Badge tone="neutral">{conditionLabel(listing.condition)}</Badge>
              {listing.categoryName ? (
                <Badge tone="outline">{listing.categoryName}</Badge>
              ) : null}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {listing.title}
            </h1>
            <p className="mt-2 text-2xl font-semibold">
              {price ?? "Swap only"}
            </p>
            <p className="mt-1 text-sm text-muted">{listing.location}</p>
          </div>

          <div>
            <ProposalForm
              listingId={listing.id}
              ownerId={listing.ownerId}
              listingType={listing.listingType}
              askCents={listing.priceCents}
            />
          </div>

          <section aria-labelledby="description-heading">
            <h2 id="description-heading" className="font-medium">
              Description
            </h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted">
              {listing.description}
            </p>
          </section>

          {seller ? <SellerCard profile={seller} /> : null}
        </div>
      </div>

      <Suspense fallback={<Skeleton className="mt-10 h-48 w-full" />}>
        <SimilarListings
          categoryId={listing.categoryId}
          currentId={listing.id}
        />
      </Suspense>
    </PageContainer>
  );
}
