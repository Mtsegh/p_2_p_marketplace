import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { notifyDealEvent } from "../notifications/deal-notifications.service.js";
import { testPaymentProvider } from "../payments/payment.provider.js";
import type { ResolveDisputeInput } from "./dispute.schemas.js";

const DISPUTE_INCLUDE = { evidence: true } as const;

/**
 * Opens a dispute on a deal whose funds are secured. Either participant may
 * open it. Moving the deal to DISPUTED freezes the escrow expiry processor
 * (it only handles PAYMENT_PENDING deals).
 */
export async function openDispute(
  dealId: string,
  userId: string,
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const deal = await tx.deal.findUnique({
      where: { id: dealId },
      include: {
        listing: { select: { title: true } },
        transactions: true,
      },
    });

    if (!deal) {
      throw AppError.notFound("Deal not found");
    }

    if (deal.buyerId !== userId && deal.sellerId !== userId) {
      throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
    }

    if (deal.status !== "PAYMENT_PENDING") {
      throw new AppError(
        "INVALID_STATUS",
        409,
        "A dispute can only be opened while funds are secured",
      );
    }

    if (!deal.transactions[0] || deal.transactions[0].status !== "SUCCEEDED") {
      throw new AppError(
        "NO_SECURED_FUNDS",
        409,
        "No secured funds are held for this deal",
      );
    }

    const existing = await tx.dispute.findUnique({ where: { dealId } });

    if (existing) {
      throw new AppError("DISPUTE_EXISTS", 409, "A dispute already exists for this deal");
    }

    const dispute = await tx.dispute.create({
      data: { dealId, openedById: userId, reason },
      include: DISPUTE_INCLUDE,
    });

    await tx.deal.update({
      where: { id: dealId },
      data: { status: "DISPUTED" },
    });

    await tx.dealHistory.create({
      data: {
        dealId,
        fromStatus: "PAYMENT_PENDING",
        toStatus: "DISPUTED",
        note: `Dispute opened: ${reason.slice(0, 200)}`,
      },
    });

    return dispute;
  });
}

/**
 * Admin resolution: release all funds to the seller, refund all to the buyer,
 * or split between them. Money moves through the gateway, a ledger entry is
 * written, the dispute is RESOLVED, and the deal moves to RESOLVED. Idempotent
 * by the dispute status guard.
 */
export async function resolveDispute(
  disputeId: string,
  adminId: string,
  input: ResolveDisputeInput,
) {
  const result = await prisma.$transaction(async (tx) => {
    const dispute = await tx.dispute.findUnique({
      where: { id: disputeId },
      include: { deal: { include: { transactions: true } } },
    });

    if (!dispute) {
      throw AppError.notFound("Dispute not found");
    }

    if (dispute.status !== "OPEN") {
      throw new AppError("DISPUTE_RESOLVED", 409, "This dispute is already resolved");
    }

    const deal = dispute.deal;
    const txRow = deal.transactions[0];

    if (!txRow) {
      throw new AppError("NO_TRANSACTION", 409, "No transaction for this deal");
    }

    const net = Math.max(0, txRow.amountCents - txRow.feeCents);
    const sellerAmount =
      input.resolution === "RELEASE"
        ? net
        : input.resolution === "SPLIT"
          ? Math.floor(net / 2)
          : 0;
    const buyerAmount = net - sellerAmount;

    if (buyerAmount > 0) {
      await testPaymentProvider.refund(txRow.providerPaymentId, buyerAmount);
      await tx.ledgerEntry.create({
        data: {
          transactionId: txRow.id,
          type: "REFUND",
          amountCents: buyerAmount,
          currency: txRow.currency,
          reference: `dispute-refund:${disputeId}`,
        },
      });
    }

    if (sellerAmount > 0) {
      await testPaymentProvider.payout(txRow.providerPaymentId, sellerAmount);
      await tx.ledgerEntry.create({
        data: {
          transactionId: txRow.id,
          type: "PAYOUT",
          amountCents: sellerAmount,
          currency: txRow.currency,
          reference: `dispute-payout:${disputeId}`,
        },
      });
    }

    const updated = await tx.dispute.update({
      where: { id: disputeId },
      data: {
        status: "RESOLVED",
        resolution: input.resolution,
        resolutionNote: input.note,
        resolvedById: adminId,
        resolvedAt: new Date(),
      },
      include: DISPUTE_INCLUDE,
    });

    await tx.deal.update({
      where: { id: deal.id },
      data: { status: "RESOLVED" },
    });

    await tx.dealHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: "DISPUTED",
        toStatus: "RESOLVED",
        note: `Dispute resolved: ${input.resolution}`,
      },
    });

    return updated;
  });

  // Notify both sides.
  try {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { deal: { select: { buyerId: true, sellerId: true, listing: { select: { title: true } } } } },
    });

    if (dispute) {
      const event = input.resolution === "REFUND" ? "refund_issued" : "deal_cancelled";
      for (const recipientId of [dispute.deal.buyerId, dispute.deal.sellerId]) {
        await notifyDealEvent({
          dealId: dispute.dealId,
          event,
          recipientId,
          listingTitle: dispute.deal.listing.title,
        });
      }
    }
  } catch (error) {
    logger.error({ err: error }, "could not send dispute resolution emails");
  }

  return result;
}

export async function getDisputeForDeal(dealId: string) {
  return prisma.dispute.findUnique({
    where: { dealId },
    include: DISPUTE_INCLUDE,
  });
}

export async function listDisputes(status?: "OPEN" | "RESOLVED") {
  return prisma.dispute.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: DISPUTE_INCLUDE,
  });
}
