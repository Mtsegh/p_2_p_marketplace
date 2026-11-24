import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import type { CreateReportInput } from "./report.schemas.js";

/**
 * Files a report on a listing or user. Verifies the target exists and that the
 * reporter is not reporting themselves. Duplicate open reports by the same
 * reporter on the same target are rejected.
 */
export async function createReport(
  reporterId: string,
  input: CreateReportInput,
) {
  if (input.targetType === "user" && input.targetId === reporterId) {
    throw new AppError("SELF_REPORT", 422, "You cannot report yourself");
  }

  if (input.targetType === "listing") {
    const listing = await prisma.listing.findUnique({
      where: { id: input.targetId },
      select: { ownerId: true },
    });

    if (!listing) {
      throw AppError.notFound("Listing not found");
    }

    if (listing.ownerId === reporterId) {
      throw new AppError("SELF_REPORT", 422, "You cannot report your own listing");
    }
  } else {
    const user = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    });

    if (!user) {
      throw AppError.notFound("User not found");
    }
  }

  const existing = await prisma.report.findFirst({
    where: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      status: "OPEN",
    },
  });

  if (existing) {
    throw new AppError("REPORT_EXISTS", 409, "You already reported this");
  }

  return prisma.report.create({
    data: {
      reporterId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    },
  });
}

/** Paginated moderation queue, newest first. */
export async function listReports(status?: "OPEN" | "ACTIONED" | "DISMISSED") {
  return prisma.report.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/**
 * Resolves a report. "actioned" may optionally suspend a reported user or
 * remove a reported listing; "dismissed" closes it with no action. Every
 * resolution is recorded in the admin audit log by the controller layer via
 * the shared audit helper.
 */
export async function resolveReport(
  reportId: string,
  adminId: string,
  input: {
    action: "actioned" | "dismissed";
    note?: string;
    suspendUser?: boolean;
  },
) {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUnique({ where: { id: reportId } });

    if (!report) {
      throw AppError.notFound("Report not found");
    }

    if (report.status !== "OPEN") {
      throw new AppError("REPORT_RESOLVED", 409, "This report is already resolved");
    }

    const status = input.action === "actioned" ? "ACTIONED" : "DISMISSED";

    if (input.action === "actioned" && input.suspendUser) {
      if (report.targetType === "user") {
        await tx.user.update({
          where: { id: report.targetId },
          data: { status: "SUSPENDED" },
        });
        await tx.session.updateMany({
          where: { userId: report.targetId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else {
        await tx.listing.update({
          where: { id: report.targetId },
          data: { status: "REMOVED" },
        });
      }
    }

    return tx.report.update({
      where: { id: reportId },
      data: {
        status,
        note: input.note,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
    });
  });
}
