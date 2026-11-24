import { apiRequest, apiRequestJson } from "./api";

export interface Report {
  id: string;
  reporterId: string;
  targetType: "listing" | "user";
  targetId: string;
  reason: string;
  status: "OPEN" | "ACTIONED" | "DISMISSED";
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function createReport(input: {
  targetType: "listing" | "user";
  targetId: string;
  reason: string;
}): Promise<Report> {
  const response = await apiRequestJson<{ data: { report: Report } }>(
    "/api/v1/reports",
    "POST",
    input,
  );

  return response.data.report;
}

export async function fetchReports(): Promise<Report[]> {
  const response = await apiRequest<{ data: { reports: Report[] } }>(
    "/api/v1/reports",
  );

  return response.data.reports;
}

export async function resolveReport(
  reportId: string,
  input: {
    action: "actioned" | "dismissed";
    note?: string;
    suspendUser?: boolean;
  },
): Promise<Report> {
  const response = await apiRequestJson<{ data: { report: Report } }>(
    `/api/v1/reports/${encodeURIComponent(reportId)}/resolve`,
    "PATCH",
    input,
  );

  return response.data.report;
}
