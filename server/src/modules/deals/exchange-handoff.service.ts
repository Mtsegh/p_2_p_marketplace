import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { notifyDealEvent } from "../notifications/deal-notifications.service.js";
import { testPaymentProvider } from "../payments/payment.provider.js";

/**
 * Exchange deals complete only after BOTH parties confirm the handoff
 * (a "dual lock"). Either party may confirm first; one-sided confirmation
 * leaves the deal in PAYMENT_PENDING with that side's timestamp recorded.
 * When the second confirmation arrives, the deal is completed atomically and
 * any cash top-up held in escrow is released to the seller.
 */
export async function confirmExchangeHandoff(
  dealId: string,
  userId: string,
) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      listing: { select: { title: true } },
      transactions: true,
    },
  });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.type !== "EXCHANGE") {
    throw new AppError(
      "NOT_AN_EXCHANGE_DEAL",
      422,
      "This deal does not use dual confirmation",
    );
  }

  if (deal.buyerId !== userId && deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
  }

  if (deal.status !== "PAYMENT_PENDING") {
    throw new AppError(
      "INVALID_STATUS",
      409,
      "Handoff confirmation is only available while funds are secured",
    );
  }

  const isBuyer = deal.buyerId === userId;
  const alreadyConfirmed = isBuyer
    ? deal.buyerConfirmedAt
    : deal.sellerConfirmedAt;

  if (alreadyConfirmed) {
    return {
      status: deal.status,
      buyerConfirmedAt: deal.buyerConfirmedAt?.toISOString() ?? null,
      sellerConfirmedAt: deal.sellerConfirmedAt?.toISOString() ?? null,
      completed: false,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.deal.findUnique({ where: { id: dealId } });

    if (!current || current.status !== "PAYMENT_PENDING") {
      throw new AppError("INVALID_STATUS", 409, "This deal is no longer awaiting handoff");
    }

    const buyerConfirmedAt = isBuyer ? new Date() : current.buyerConfirmedAt;
    const sellerConfirmedAt = isBuyer ? current.sellerConfirmedAt : new Date();
    const bothConfirmed = Boolean(buyerConfirmedAt && sellerConfirmedAt);

    if (bothConfirmed) {
      // Release any cash top-up held in escrow to the seller.
      const txRow = deal.transactions[0] ?? null;
      const transaction = txRow
        ? await tx.transaction.findUnique({ where: { id: txRow.id } })
        : null;

      if (transaction && transaction.status === "SUCCEEDED") {
        const net = Math.max(0, transaction.amountCents - transaction.feeCents);
        await testPaymentProvider.payout(transaction.providerPaymentId, net);
        await tx.ledgerEntry.create({
          data: {
            transactionId: transaction.id,
            type: "PAYOUT",
            amountCents: net,
            currency: transaction.currency,
            reference: `payout:${dealId}`,
          },
        });
      }

      const updated = await tx.deal.update({
        where: { id: dealId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          buyerConfirmedAt,
          sellerConfirmedAt,
        },
      });

      await tx.dealHistory.create({
        data: {
          dealId,
          fromStatus: "PAYMENT_PENDING",
          toStatus: "COMPLETED",
          note: "Both parties confirmed the exchange handoff",
        },
      });

      return { deal: updated, completed: true };
    }

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: { buyerConfirmedAt, sellerConfirmedAt },
    });

    await tx.dealHistory.create({
      data: {
        dealId,
        fromStatus: "PAYMENT_PENDING",
        toStatus: "PAYMENT_PENDING",
        note: `${isBuyer ? "Buyer" : "Seller"} confirmed the handoff; waiting for the other party`,
      },
    });

    return { deal: updated, completed: false };
  });

  // Notify both sides on completion.
  if (result.completed) {
    try {
      for (const recipientId of [deal.buyerId, deal.sellerId]) {
        await notifyDealEvent({
          dealId,
          event: "handoff_completed",
          recipientId,
          listingTitle: deal.listing.title,
        });
      }
    } catch (error) {
      logger.error({ err: error }, "could not send exchange completion emails");
    }
  }

  return {
    status: result.deal.status,
    buyerConfirmedAt: result.deal.buyerConfirmedAt?.toISOString() ?? null,
    sellerConfirmedAt: result.deal.sellerConfirmedAt?.toISOString() ?? null,
    completed: result.completed,
  };
}
