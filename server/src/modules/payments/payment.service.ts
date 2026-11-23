import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { logger } from "../../lib/logger.js";
import { notifyDealEvent } from "../notifications/deal-notifications.service.js";
import { testPaymentProvider } from "./payment.provider.js";
import * as repository from "./payment.repository.js";
import type { WebhookPayload } from "./payment.schemas.js";

/** Net amount the seller would receive after the platform fee. */
function dealsNetAmount(amountCents: number, feeCents: number): number {
  return Math.max(0, amountCents - feeCents);
}

/**
 * Starts hosted checkout for an accepted sale deal. Only the buyer may pay.
 * The amount is the agreed deal price in cents. A deterministic idempotency key
 * means retrying this call reuses the same gateway payment.
 */
export async function createCheckout(userId: string, dealId: string) {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: { transactions: true },
  });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.buyerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the buyer can pay for this deal");
  }

  if (deal.type !== "SALE" || deal.amountCents === null) {
    throw new AppError(
      "NOT_A_SALE_DEAL",
      422,
      "Only sale deals with a price can be paid",
    );
  }

  if (deal.status !== "ACCEPTED") {
    throw new AppError(
      "INVALID_STATUS",
      409,
      "Payment can only start for an accepted deal",
    );
  }

  // Return the existing pending/succeeded transaction's checkout URL on retry.
  const existing = deal.transactions[0];

  if (existing) {
    const url = `https://checkout.test/pay/${existing.providerPaymentId}`;
    return {
      checkoutUrl: url,
      amountCents: existing.amountCents,
      currency: existing.currency,
      provider: existing.provider,
    };
  }

  const intent = await testPaymentProvider.createPayment({
    amountCents: deal.amountCents,
    currency: "USD",
    description: `Payment for deal ${deal.id}`,
    idempotencyKey: deal.id,
  });

  await repository.createTransaction({
    dealId: deal.id,
    provider: testPaymentProvider.name,
    providerPaymentId: intent.providerPaymentId,
    amountCents: intent.amountCents,
    feeCents: Math.round((intent.amountCents * env.PLATFORM_FEE_BPS) / 10000),
    currency: intent.currency,
  });

  return {
    checkoutUrl: intent.checkoutUrl,
    amountCents: intent.amountCents,
    currency: intent.currency,
    provider: testPaymentProvider.name,
  };
}

/**
 * Handles a verified, parsed webhook. Idempotent via the unique event id:
 * a replayed event is recorded once and has no further effect. On a genuine
 * success it marks the transaction SUCCEEDED and moves the deal to
 * PAYMENT_PENDING, all in one transaction.
 */
export async function handleWebhook(payload: WebhookPayload) {
  if (payload.type !== "payment.succeeded") {
    // Failed payments are recorded as events but do not change deal state here.
    await prisma.webhookEvent.create({
      data: {
        providerEventId: payload.id,
        provider: testPaymentProvider.name,
        type: payload.type,
        payload: payload as object,
      },
    });
    return { alreadyProcessed: false, changed: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const applied = await repository.applySucceededEvent(tx, {
      providerEventId: payload.id,
      provider: testPaymentProvider.name,
      type: payload.type,
      payload,
      providerPaymentId: payload.data.providerPaymentId,
    });

    if (!applied.alreadyProcessed && applied.transaction) {
      const deal = await tx.deal.findUnique({
        where: { id: applied.transaction.dealId },
      });

      if (deal && deal.status === "ACCEPTED") {
        const escrowExpiresAt = new Date(
          Date.now() + env.ESCROW_WINDOW_DAYS * 86_400_000,
        );

        await tx.deal.update({
          where: { id: deal.id },
          data: { status: "PAYMENT_PENDING", escrowExpiresAt },
        });
        await tx.dealHistory.create({
          data: {
            dealId: deal.id,
            fromStatus: "ACCEPTED",
            toStatus: "PAYMENT_PENDING",
            note: `Payment secured; funds held until ${escrowExpiresAt.toISOString()}`,
          },
        });
        // Ledger: the platform now holds the funds (net of its fee).
        await tx.ledgerEntry.create({
          data: {
            transactionId: applied.transaction.id,
            type: "HOLD",
            amountCents: dealsNetAmount(
              applied.transaction.amountCents,
              applied.transaction.feeCents,
            ),
            currency: applied.transaction.currency,
            reference: `escrow:${deal.id}`,
          },
        });
      }
    }

    return applied;
  });

  // Notify both sides once funds are secured (idempotent notification keys).
  if (!result.alreadyProcessed && result.transaction) {
    try {
      const deal = await prisma.deal.findUnique({
        where: { id: result.transaction.dealId },
        select: { buyerId: true, sellerId: true, listing: { select: { title: true } } },
      });

      if (deal) {
        for (const recipientId of [deal.buyerId, deal.sellerId]) {
          await notifyDealEvent({
            dealId: result.transaction.dealId,
            event: "funds_secured",
            recipientId,
            listingTitle: deal.listing.title,
          });
        }
      }
    } catch (error) {
      logger.error({ err: error }, "could not send funds-secured notifications");
    }
  }

  return {
    alreadyProcessed: result.alreadyProcessed,
    changed: !result.alreadyProcessed && result.transaction !== null,
  };
}

export function getTransactionForDeal(dealId: string) {
  return repository.findTransactionForDeal(dealId);
}

export function listTransactions(userId: string) {
  return repository.listTransactionsForUser(userId);
}
