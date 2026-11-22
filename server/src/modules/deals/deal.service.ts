import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import * as repository from "./deal.repository.js";
import { actorFor, assertTransition } from "./deal-state-machine.js";
import type {
  CreateProposalInput,
  ListDealsQuery,
} from "./deal.schemas.js";

/**
 * Creates a sale proposal. Rules: the listing must exist and be ACTIVE, the
 * buyer cannot propose on their own listing, and the buyer must have a verified
 * email (the route enforces that too, but the service is the source of truth).
 */
export async function createProposal(buyerId: string, input: CreateProposalInput) {
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
    where: { id: input.listingId },
    select: { id: true, ownerId: true, status: true, listingType: true },
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

  if (listing.listingType === "EXCHANGE") {
    throw new AppError(
      "EXCHANGE_ONLY",
      422,
      "This listing only accepts exchange offers",
    );
  }

  try {
    return await repository.createProposal({
      listingId: listing.id,
      buyerId,
      sellerId: listing.ownerId,
      amountCents: input.amountCents,
    });
  } catch (error) {
    // The partial unique index rejects a second PROPOSED deal by the same buyer.
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

  assertTransition(deal.status, "ACCEPTED");

  const updated = await repository.acceptDeal({ dealId, actorId: userId });

  if (!updated) {
    throw new AppError(
      "LISTING_NOT_AVAILABLE",
      409,
      "This listing is no longer available",
    );
  }

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
