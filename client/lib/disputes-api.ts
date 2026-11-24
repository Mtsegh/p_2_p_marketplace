import { apiRequest, apiRequestJson } from "./api";

export interface Dispute {
  id: string;
  dealId: string;
  openedById: string;
  reason: string;
  status: "OPEN" | "RESOLVED";
  resolution: "RELEASE" | "REFUND" | "SPLIT" | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  evidence: Array<{ id: string; url: string; mimeType: string }>;
}

export async function openDispute(
  dealId: string,
  reason: string,
): Promise<Dispute> {
  const response = await apiRequestJson<{ data: { dispute: Dispute } }>(
    "/api/v1/disputes",
    "POST",
    { dealId, reason },
  );

  return response.data.dispute;
}

export async function fetchDealDispute(
  dealId: string,
): Promise<Dispute | null> {
  try {
    const response = await apiRequest<{ data: { dispute: Dispute } }>(
      `/api/v1/disputes/deal/${encodeURIComponent(dealId)}`,
    );

    return response.data.dispute;
  } catch {
    return null;
  }
}

export async function fetchDisputes(): Promise<Dispute[]> {
  const response = await apiRequest<{ data: { disputes: Dispute[] } }>(
    "/api/v1/disputes",
  );

  return response.data.disputes;
}

export async function resolveDispute(
  disputeId: string,
  resolution: "RELEASE" | "REFUND" | "SPLIT",
  note?: string,
): Promise<Dispute> {
  const response = await apiRequestJson<{ data: { dispute: Dispute } }>(
    `/api/v1/disputes/${encodeURIComponent(disputeId)}/resolve`,
    "PATCH",
    { resolution, ...(note ? { note } : {}) },
  );

  return response.data.dispute;
}

export const RESOLUTION_LABELS: Record<
  "RELEASE" | "REFUND" | "SPLIT",
  string
> = {
  RELEASE: "Release to seller",
  REFUND: "Refund buyer",
  SPLIT: "Split 50/50",
};
