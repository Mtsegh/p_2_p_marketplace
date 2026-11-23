import { apiRequest, apiRequestJson } from "./api";

export type DealStatus =
  | "PROPOSED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED"
  | "PAYMENT_PENDING"
  | "COMPLETED"
  | "DISPUTED"
  | "RESOLVED";
export type DealType = "SALE" | "EXCHANGE";

export interface DealHistoryItem {
  id: string;
  actorId: string | null;
  fromStatus: DealStatus;
  toStatus: DealStatus;
  note: string | null;
  createdAt: string;
}

export interface OfferedListing {
  listingId: string;
  listingTitle: string;
}

export interface Deal {
  id: string;
  listingId: string;
  listingTitle: string;
  offeredListings: OfferedListing[];
  buyerId: string;
  buyerDisplayName: string;
  sellerId: string;
  sellerDisplayName: string;
  type: DealType;
  amountCents: number | null;
  status: DealStatus;
  createdAt: string;
  updatedAt: string;
  history: DealHistoryItem[];
}

export interface ListDealsResult {
  deals: Deal[];
  nextCursor: string | null;
}

/** Creates a sale proposal on a listing. */
export async function createProposal(input: {
  listingId: string;
  amountCents: number;
}): Promise<Deal> {
  const response = await apiRequestJson<{ data: { deal: Deal } }>(
    "/api/v1/deals",
    "POST",
    input,
  );

  return response.data.deal;
}

/** Creates an exchange proposal with the buyer's offered listings. */
export async function createExchangeProposal(input: {
  listingId: string;
  offeredListingIds: string[];
  topUpCents?: number;
}): Promise<Deal> {
  const response = await apiRequestJson<{ data: { deal: Deal } }>(
    "/api/v1/deals/exchange",
    "POST",
    input,
  );

  return response.data.deal;
}

/** Fetches a single deal with its full history. */
export async function fetchDeal(dealId: string): Promise<Deal> {
  const response = await apiRequest<{ data: { deal: Deal } }>(
    `/api/v1/deals/${encodeURIComponent(dealId)}`,
  );

  return response.data.deal;
}

/** Lists the caller's deals, optionally filtered by role and status. */
export async function fetchDeals(query: {
  role?: "buyer" | "seller" | "all";
  status?: DealStatus;
  limit?: number;
  cursor?: string;
} = {}): Promise<ListDealsResult> {
  const params = new URLSearchParams();

  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);

  const response = await apiRequest<{ data: ListDealsResult }>(
    `/api/v1/deals?${params.toString()}`,
  );

  return response.data;
}

function transition(dealId: string, action: string): Promise<Deal> {
  return apiRequestJson<{ data: { deal: Deal } }>(
    `/api/v1/deals/${encodeURIComponent(dealId)}/${action}`,
    "POST",
  ).then((response) => response.data.deal);
}

export const acceptDeal = (dealId: string) => transition(dealId, "accept");
export const rejectDeal = (dealId: string) => transition(dealId, "reject");
export const cancelDeal = (dealId: string) => transition(dealId, "cancel");

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  PROPOSED: "Proposed",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  PAYMENT_PENDING: "Payment pending",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  RESOLVED: "Resolved",
};

export function formatDealAmount(cents: number | null): string {
  if (cents === null) {
    return "Exchange";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
