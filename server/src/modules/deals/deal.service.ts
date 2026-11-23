import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { notifyDealEvent, type DealEvent } from "../notifications/deal-notifications.service.js";
import * as repository from "./deal.repository.js";
import { actorFor, assertTransition } from "./deal-state-machine.js";
import type {
  CreateExchangeProposalInput,
  CreateProposalInput,
  ListDealsQuery,
} from "./deal.schemas.js";

/** Notifications never block a deal state change. */
async function notify(input: {
  dealId: string;
  event: DealEvent;
  recipientId: string;
  listingTitle: string;
}): Promise<void> {
  try {
    await notifyDealEvent(input);
  } catch (error) {
    logger.error({ err: error, ...input }, "could not send deal notification");
  }
}

/** Shared guards for any proposal: verified email, active listing, not own listing. */
async function validateProposer(
  buyerId: string,
  listingId: string,
  acceptSale: boolean,
) {
  const buyer = await prisma.user.findUnique({
    where: { id: buyerId },
    select: { emailVerifiedAt: true },
  });

  if (!buyer?.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      403,
      "Confirm your email address to make a proposal",
    );
  }

  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true, status: true, listingType: true, title: true },
  });

  if (!listing) {
    throw AppError.notFound("Listing not found");
  }

  if (listing.status !== "ACTIVE") {
    throw new AppError(
      "LISTING_NOT_AVAILABLE",
      409,
      "This listing is not available for proposals",
    );
  }

  if (listing.ownerId === buyerId) {
    throw new AppError(
      "OWN_LISTING",
      422,
      "You cannot make a proposal on your own listing",
    );
  }

  if (!acceptSale && listing.listingType === "SALE") {
    throw new AppError(
      "SALE_ONLY",
      422,
      "This listing only accepts sale offers",
    );
  }

  if (acceptSale && listing.listingType === "EXCHANGE") {
    throw new AppError(
      "EXCHANGE_ONLY",
      422,
      "This listing only accepts exchange offers",
    );
  }

  return listing;
}

function translateDuplicate(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new AppError(
      "PROPOSAL_EXISTS",
      409,
      "You already have a pending proposal on this listing",
    );
  }

  throw error;
}

/**
 * Creates a sale proposal. Rules: the listing must exist and be ACTIVE, the
 * buyer cannot propose on their own listing, and the buyer must have a verified
 * email (the route enforces that too, but the service is the source of truth).
 */
export async function createProposal(buyerId: string, input: CreateProposalInput) {
  const listing = await validateProposer(buyerId, input.listingId, true);

  try {
    const deal = await repository.createProposal({
      listingId: listing.id,
      buyerId,
      sellerId: listing.ownerId,
      amountCents: input.amountCents,
    });

    await notify({
      dealId: deal.id,
      event: "proposal_received",
      recipientId: listing.ownerId,
      listingTitle: listing.title ?? "your listing",
    });

    return deal;
  } catch (error) {
    translateDuplicate(error);
  }
}

/**
 * Creates an exchange proposal. Every offered listing must belong to the buyer
 * and be ACTIVE; the optional cash top-up is stored as the deal amount.
 */
export async function createExchangeProposal(
  buyerId: string,
  input: CreateExchangeProposalInput,
) {
  const listing = await validateProposer(buyerId, input.listingId, false);

  const offered = await prisma.listing.findMany({
    where: {
      id: { in: input.offeredListingIds },
      ownerId: buyerId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (offered.length !== input.offeredListingIds.length) {
    throw new AppError(
      "INVALID_OFFERED_LISTINGS",
      422,
      "Every offered listing must be one of your active listings",
    );
  }

  // An active deal must not already involve any offered listing.
  const busy = await prisma.deal.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { listingId: { in: input.offeredListingIds } },
        { offeredListings: { some: { listingId: { in: input.offeredListingIds } } } },
      ],
    },
  });

  if (busy) {
    throw new AppError(
      "LISTING_NOT_AVAILABLE",
      409,
      "One of your offered listings is already part of a deal",
    );
  }

  try {
    const created = await repository.createExchangeProposal({
      listingId: listing.id,
      buyerId,
      sellerId: listing.ownerId,
      topUpCents: input.topUpCents ?? null,
      offeredListingIds: input.offeredListingIds,
    });

    if (!created) {
      throw AppError.notFound("Deal not found after creation");
    }

    await notify({
      dealId: created.id,
      event: "proposal_received",
      recipientId: listing.ownerId,
      listingTitle: listing.title ?? "your listing",
    });

    return created;
  } catch (error) {
    translateDuplicate(error);
  }
}

/**
 * Accepts a proposal. Only the seller may accept, and only from PROPOSED.
 * Returns null from the repository when the listing is no longer ACTIVE
 * (someone else's accepted deal reserved it first).
 */
export async function acceptDeal(dealId: string, userId: string) {
  const deal = await repository.findDealById(dealId);

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the seller can accept this deal");
  }

  // A sale deal moves money to the seller, so they must be onboarded for
  // payouts first. Exchange deals without a cash top-up need no payout account.
  const needsPayout =
    deal.type === "SALE" || (deal.amountCents !== null && deal.amountCents > 0);

  if (needsPayout) {
    const seller = await prisma.user.findUnique({
      where: { id: deal.sellerId },
      select: { payoutOnboardedAt: true },
    });

    if (!seller?.payoutOnboardedAt) {
      throw new AppError(
        "PAYOUT_NOT_ONBOARDED",
        403,
        "Complete payout onboarding before accepting a paid deal",
      );
    }
  }

  assertTransition(deal.status, "ACCEPTED");

  const updated = await repository.acceptDeal({ dealId, actorId: userId });

  if (!updated) {
    throw new AppError(
      "LISTING_NOT_AVAILABLE",
      409,
      "This listing is no longer available",
    );
  }

  // A pure exchange (no cash top-up) has no payment step, so move it straight
  // into the handoff phase where both parties must confirm.
  if (deal.type === "EXCHANGE" && (deal.amountCents === null || deal.amountCents === 0)) {
    const escrowExpiresAt = new Date(Date.now() + env.ESCROW_WINDOW_DAYS * 86_400_000);
    await prisma.$transaction(async (tx) => {
      await tx.deal.update({
        where: { id: deal.id },
        data: { status: "PAYMENT_PENDING", escrowExpiresAt },
      });
      await tx.dealHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: "ACCEPTED",
          toStatus: "PAYMENT_PENDING",
          note: "Exchange accepted; awaiting handoff confirmation from both parties",
        },
      });
    });
    updated.status = "PAYMENT_PENDING";
  }

  await notify({
    dealId: deal.id,
    event: "proposal_accepted",
    recipientId: deal.buyerId,
    listingTitle: deal.listing?.title ?? "your listing",
  });

  return updated;
}

/**
 * Rejects a proposal (seller) or cancels it (buyer). The state machine decides
 * which actors may perform each transition.
 */
export async function endDeal(
  dealId: string,
  userId: string,
  toStatus: "REJECTED" | "CANCELLED",
) {
  const deal = await repository.findDealById(dealId);

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  assertTransition(deal.status, toStatus);

  const allowedActor = actorFor(toStatus);

  if (allowedActor === "seller" && deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the seller can do this");
  }
  if (allowedActor === "buyer" && deal.buyerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the buyer can do this");
  }

  const updated = await repository.endDeal({
    dealId,
    actorId: userId,
    toStatus,
  });

  if (!updated) {
    throw new AppError(
      "INVALID_TRANSITION",
      409,
      "This deal can no longer be changed",
    );
  }

  await notify({
    dealId: deal.id,
    event: toStatus === "REJECTED" ? "proposal_rejected" : "deal_cancelled",
    recipientId: toStatus === "REJECTED" ? deal.buyerId : deal.sellerId,
    listingTitle: deal.listing?.title ?? "your listing",
  });

  return updated;
}

/** Loads a single deal with full history and checks object-level access. */
export async function getDeal(dealId: string, userId: string) {
  const deal = await repository.findDealById(dealId);

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.buyerId !== userId && deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
  }

  return deal;
}

/** Lists the caller's deals with pagination. */
export async function listDeals(userId: string, query: ListDealsQuery) {
  const result = await repository.listDeals(userId, query);

  return {
    deals: result.deals,
    nextCursor: result.nextCursor,
  };
}
