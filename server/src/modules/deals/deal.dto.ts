import type { Deal, DealHistory, DealStatus, DealType } from "../../generated/prisma/client.js";

export interface DealHistoryDto {
  id: string;
  actorId: string | null;
  fromStatus: DealStatus;
  toStatus: DealStatus;
  note: string | null;
  createdAt: string;
}

export interface OfferedListingDto {
  listingId: string;
  listingTitle: string;
}

export interface DealDto {
  id: string;
  listingId: string;
  listingTitle: string;
  offeredListings: OfferedListingDto[];
  buyerId: string;
  buyerDisplayName: string;
  sellerId: string;
  sellerDisplayName: string;
  type: DealType;
  amountCents: number | null;
  status: DealStatus;
  escrowExpiresAt: string | null;
  buyerConfirmedAt: string | null;
  sellerConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: DealHistoryDto[];
}

type DealWithRelations = Deal & {
  listing: { title: string };
  buyer: { profile: { displayName: string } | null };
  seller: { profile: { displayName: string } | null };
  history: DealHistory[];
  offeredListings: Array<{
    listingId: string;
    listing: { title: string };
  }>;
};

export function toDealDto(deal: DealWithRelations): DealDto {
  return {
    id: deal.id,
    listingId: deal.listingId,
    listingTitle: deal.listing.title,
    offeredListings: deal.offeredListings.map((item) => ({
      listingId: item.listingId,
      listingTitle: item.listing.title,
    })),
    buyerId: deal.buyerId,
    buyerDisplayName: deal.buyer.profile?.displayName ?? "Marketplace member",
    sellerId: deal.sellerId,
    sellerDisplayName: deal.seller.profile?.displayName ?? "Marketplace member",
    type: deal.type,
    amountCents: deal.amountCents,
    status: deal.status,
    escrowExpiresAt: deal.escrowExpiresAt?.toISOString() ?? null,
    buyerConfirmedAt: deal.buyerConfirmedAt?.toISOString() ?? null,
    sellerConfirmedAt: deal.sellerConfirmedAt?.toISOString() ?? null,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    history: deal.history.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      note: event.note,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export interface ListDealsResult {
  deals: DealDto[];
  nextCursor: string | null;
}
