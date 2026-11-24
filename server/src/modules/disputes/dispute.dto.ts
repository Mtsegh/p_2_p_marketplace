import type { Dispute, DisputeEvidence, DisputeResolution, DisputeStatus } from "../../generated/prisma/client.js";

export interface DisputeDto {
  id: string;
  dealId: string;
  openedById: string;
  reason: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  evidence: Array<{ id: string; url: string; mimeType: string }>;
}

export function toDisputeDto(
  dispute: Dispute & { evidence: DisputeEvidence[] },
): DisputeDto {
  return {
    id: dispute.id,
    dealId: dispute.dealId,
    openedById: dispute.openedById,
    reason: dispute.reason,
    status: dispute.status,
    resolution: dispute.resolution,
    resolutionNote: dispute.resolutionNote,
    createdAt: dispute.createdAt.toISOString(),
    resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    evidence: dispute.evidence.map((item) => ({
      id: item.id,
      url: item.url,
      mimeType: item.mimeType,
    })),
  };
}
