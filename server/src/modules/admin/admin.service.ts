import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { toUserDto } from "../auth/auth.dto.js";
import { getEffectiveSettings, type EffectiveSettings } from "./admin.settings.js";
import type { ListingParams, SettingsInput } from "./admin.types.js";

/** Writes an audit record for an admin action (before/after snapshots). */
async function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  before: object | null,
  after: object | null,
): Promise<void> {
  await tx.adminAuditLog.create({
    data: {
      actorId,
      action,
      targetType,
      targetId,
      before: (before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      after: (after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
  });
}

/** Suspends or reactivates a user, recording the before/after status. */
export async function setUserStatus(
  actorId: string,
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
) {
  if (actorId === userId) {
    throw new AppError("SELF_ACTION", 422, "You cannot change your own status");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { profile: true } });

    if (!user) {
      throw AppError.notFound("User not found");
    }

    const before = { status: user.status };

    await tx.user.update({ where: { id: userId }, data: { status } });

    // Suspending a user ends their sessions immediately.
    if (status === "SUSPENDED") {
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await audit(tx, actorId, "user.status", "user", userId, before, { status });

    const updated = await tx.user.findUnique({ where: { id: userId }, include: { profile: true } });
    return toUserDto(updated!);
  });
}

/** Removes or restores a listing by setting its moderation status. */
export async function moderateListing(
  actorId: string,
  listingId: string,
  action: "remove" | "restore",
  reason?: string,
) {
  const status = action === "remove" ? "REMOVED" : "ACTIVE";

  return prisma.$transaction(async (tx) => {
    const listing = await tx.listing.findUnique({ where: { id: listingId } });

    if (!listing) {
      throw AppError.notFound("Listing not found");
    }

    if (action === "restore" && listing.status !== "REMOVED") {
      throw new AppError("INVALID_STATUS", 409, "Only removed listings can be restored");
    }

    const before = { status: listing.status };

    await tx.listing.update({ where: { id: listingId }, data: { status } });

    await audit(tx, actorId, `listing.${action}`, "listing", listingId, before, {
      status,
      ...(reason ? { reason } : {}),
    });

    return { id: listing.id, title: listing.title, status };
  });
}

/** Persists validated settings and records each change in the audit log. */
export async function updateSettings(actorId: string, input: SettingsInput) {
  return prisma.$transaction(async (tx) => {
    const before = await getEffectiveSettings();

    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue;

      await tx.platformSetting.upsert({
        where: { key },
        create: { key, value: { value } },
        update: { value: { value } },
      });

      await audit(tx, actorId, `setting.${key}`, "setting", key, { value: before[key as keyof EffectiveSettings] }, { value });
    }

    return getEffectiveSettings();
  });
}

export async function getSettings(): Promise<EffectiveSettings> {
  return getEffectiveSettings();
}

/** Paginated audit log, newest first. */
export async function listAudit({ limit, cursor }: { limit: number; cursor?: string }) {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    events: page.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      before: event.before,
      after: event.after,
      createdAt: event.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/** Admin listing overview across all statuses. */
export async function listAllListings({ status, limit, cursor }: ListingParams) {
  const rows = await prisma.listing.findMany({
    where: status ? { status } : {},
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    listings: page.map((listing) => ({
      id: listing.id,
      title: listing.title,
      ownerId: listing.ownerId,
      status: listing.status,
      priceCents: listing.priceCents,
      createdAt: listing.createdAt.toISOString(),
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}
