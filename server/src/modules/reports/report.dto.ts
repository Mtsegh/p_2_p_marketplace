import type { Report, ReportStatus } from "../../generated/prisma/client.js";

export interface ReportDto {
  id: string;
  reporterId: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: ReportStatus;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function toReportDto(report: Report): ReportDto {
  return {
    id: report.id,
    reporterId: report.reporterId,
    targetType: report.targetType,
    targetId: report.targetId,
    reason: report.reason,
    status: report.status,
    note: report.note,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: report.resolvedAt?.toISOString() ?? null,
  };
}
