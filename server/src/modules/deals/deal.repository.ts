import { Prisma } from "../../generated/prisma/client.js";
import type { DealStatus } from "../../generated/prisma/enums.js";
import { prisma } from "../../db/prisma.js";
import type { ListDealsQuery } from "./deal.schemas.js";

const DEAL_INCLUDE = {
  listing: { select: { title: true } },
  buyer: { select: { profile: { select: { displayName: true } } } },
  seller: { select: { profile: { select: { displayName: true } } } },
  history: { orderBy: { createdAt: "asc" as const } },
  offeredListings: {
    select: {
      listingId: true,
      listing: { select: { title: true } },
    },
  },
} as const;

export function findDealById(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    include: DEAL_INCLUDE,
  });
}

/**
 * Creates a proposal. The partial unique index on (listing, buyer, PROPOSED)
 * guards against duplicate proposals; a second call fails with P2002 which the
 * service translates to a clean error.
 */
export function createProposal(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  amountCents: number;
}) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        ...input,
        type: "SALE",
        status: "PROPOSED",
        history: {
          create: {
            fromStatus: "PROPOSED",
            toStatus: "PROPOSED",
            note: "Proposal created",
          },
        },
      },
      include: DEAL_INCLUDE,
    });

    return deal;
  });
}

/**
 * Creates an exchange proposal together with the offered listings. All writes
 * are in one transaction so a deal never exists without its offered listings.
 */
export function createExchangeProposal(input: {
  listingId: string;
  buyerId: string;
  sellerId: string;
  topUpCents: number | null;
  offeredListingIds: string[];
}) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.create({
      data: {
        listingId: input.listingId,
        buyerId: input.buyerId,
        sellerId: input.sellerId,
        type: "EXCHANGE",
        amountCents: input.topUpCents,
        status: "PROPOSED",
        history: {
          create: {
            fromStatus: "PROPOSED",
            toStatus: "PROPOSED",
            note: "Exchange proposal created",
          },
        },
        offeredListings: {
          create: input.offeredListingIds.map((listingId) => ({ listingId })),
        },
      },
    });

    return tx.deal.findUnique({
      where: { id: deal.id },
      include: DEAL_INCLUDE,
    });
  });
}

/**
 * Accepts a proposal atomically: locks every listing involved (the target plus
 * any offered in a swap), confirms they are all still ACTIVE, marks them all
 * RESERVED, rejects all competing PROPOSED deals on any of them (recording each
 * in history), then moves this deal to ACCEPTED.
 */
export function acceptDeal(input: {
  dealId: string;
  actorId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: input.dealId },
      include: { offeredListings: { select: { listingId: true } } },
    });

    if (!deal || deal.status !== "PROPOSED") {
      return null;
    }

    // All listings in this deal: the target plus the proposer's offered items.
    const listingIds = [
      deal.listingId,
      ...deal.offeredListings.map((item) => item.listingId),
    ];

    // Lock every listing row in a stable order to avoid deadlocks between
    // concurrent accepts touching overlapping listings.
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>(
      Prisma.sql`SELECT id, status::text FROM listings WHERE id IN (${Prisma.join(listingIds)}) ORDER BY id FOR UPDATE`,
    );

    if (locked.length !== listingIds.length || locked.some((row) => row.status !== "ACTIVE")) {
      return null;
    }

    await tx.listing.updateMany({
      where: { id: { in: listingIds } },
      data: { status: "RESERVED" },
    });

    // Reject competing proposals on any involved listing, recording history.
    const competing = await tx.deal.findMany({
      where: {
        status: "PROPOSED",
        id: { not: deal.id },
        OR: [
          { listingId: { in: listingIds } },
          { offeredListings: { some: { listingId: { in: listingIds } } } },
        ],
      },
      select: { id: true },
    });

    if (competing.length > 0) {
      await tx.deal.updateMany({
        where: { id: { in: competing.map((item) => item.id) } },
        data: { status: "REJECTED" },
      });

      await tx.dealHistory.createMany({
        data: competing.map((item) => ({
          dealId: item.id,
          actorId: input.actorId,
          fromStatus: "PROPOSED" as const,
          toStatus: "REJECTED" as const,
          note: "Rejected when another proposal was accepted",
        })),
      });
    }

    await tx.deal.update({
      where: { id: deal.id },
      data: { status: "ACCEPTED" },
    });

    await tx.dealHistory.create({
      data: {
        dealId: deal.id,
        actorId: input.actorId,
        fromStatus: "PROPOSED",
        toStatus: "ACCEPTED",
      },
    });

    // Re-read so the history entry we just wrote is included.
    return tx.deal.findUnique({
      where: { id: deal.id },
      include: DEAL_INCLUDE,
    });
  });
}

/**
 * Moves a deal to a terminal status (REJECTED or CANCELLED) with an audit
 * event. Only a PROPOSED deal may be rejected or cancelled; an ACCEPTED deal
 * is cancelled through the same path (release/refund rules come with payments).
 */
export function endDeal(input: {
  dealId: string;
  actorId: string;
  toStatus: DealStatus;
  note?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: input.dealId },
    });

    if (!deal || deal.status !== "PROPOSED") {
      return null;
    }

    await tx.deal.update({
      where: { id: deal.id },
      data: { status: input.toStatus },
    });

    await tx.dealHistory.create({
      data: {
        dealId: deal.id,
        actorId: input.actorId,
        fromStatus: deal.status,
        toStatus: input.toStatus,
        note: input.note,
      },
    });

    return tx.deal.findUnique({
      where: { id: deal.id },
      include: DEAL_INCLUDE,
    });
  });
}

/** Lists deals for a user, with cursor pagination and an optional status filter. */
export async function listDeals(userId: string, query: ListDealsQuery) {
  const roleFilter =
    query.role === "buyer"
      ? { buyerId: userId }
      : query.role === "seller"
        ? { sellerId: userId }
        : { OR: [{ buyerId: userId }, { sellerId: userId }] };

  const rows = await prisma.deal.findMany({
    where: {
      ...roleFilter,
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    include: DEAL_INCLUDE,
  });

  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return {
    deals: page,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

/** Finds a deal by listing id and status, used by the service for guards. */
export function findActiveDealForListing(listingId: string) {
  return prisma.deal.findFirst({
    where: { listingId, status: "ACCEPTED" },
  });
}

/** Counts proposals on a listing (for the seller's view). */
export function countProposals(listingId: string) {
  return prisma.deal.count({ where: { listingId } });
}
