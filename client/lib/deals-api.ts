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

export interface DealMessage {
  id: string;
  dealId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface MessageListResult {
  messages: DealMessage[];
  nextCursor: string | null;
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
  escrowExpiresAt: string | null;
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

/** Buyer reveals the one-time handoff code (only while funds are secured). */
export async function revealHandoffCode(
  dealId: string,
): Promise<{ code: string; expiresAt: string }> {
  const response = await apiRequestJson<{
    data: { code: string; expiresAt: string };
  }>(`/api/v1/deals/${encodeURIComponent(dealId)}/handoff/reveal`, "POST");

  return response.data;
}

/** Seller submits the handoff code to complete the deal and release funds. */
export async function completeHandoff(
  dealId: string,
  code: string,
): Promise<{ id: string; status: DealStatus }> {
  const response = await apiRequestJson<{
    data: { id: string; status: DealStatus };
  }>(`/api/v1/deals/${encodeURIComponent(dealId)}/handoff/complete`, "POST", {
    code,
  });

  return response.data;
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

/** Lists a deal's messages, oldest first. */
export async function fetchDealMessages(
  dealId: string,
  cursor?: string,
): Promise<MessageListResult> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);

  const response = await apiRequest<{ data: MessageListResult }>(
    `/api/v1/deals/${encodeURIComponent(dealId)}/messages?${params.toString()}`,
  );

  return response.data;
}

/** Posts a message to a deal's thread. */
export async function postDealMessage(
  dealId: string,
  body: string,
): Promise<DealMessage> {
  const response = await apiRequestJson<{ data: { message: DealMessage } }>(
    `/api/v1/deals/${encodeURIComponent(dealId)}/messages`,
    "POST",
    { body },
  );

  return response.data.message;
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
