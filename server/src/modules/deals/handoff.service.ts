import { randomInt } from "node:crypto";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { sha256Hex } from "../../lib/hash.js";
import { AppError } from "../../lib/app-error.js";
import { testPaymentProvider } from "../payments/payment.provider.js";
import { logger } from "../../lib/logger.js";
import { notifyDealEvent } from "../notifications/deal-notifications.service.js";

/** Formats a 6-digit code as "482 915" for readability. */
export function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

/** Loads a deal and checks the caller is one of its two participants. */
async function participantDeal(dealId: string, userId: string) {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });

  if (!deal) {
    throw AppError.notFound("Deal not found");
  }

  if (deal.buyerId !== userId && deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "You are not part of this deal");
  }

  return deal;
}

/**
 * Buyer reveals/creates the handoff code. Only allowed once funds are secured
 * (PAYMENT_PENDING). The plaintext is returned once; only its hash is stored.
 * Calling again returns a fresh code and resets attempts.
 */
export async function revealHandoffCode(dealId: string, userId: string) {
  const deal = await participantDeal(dealId, userId);

  if (deal.buyerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the buyer can view the handoff code");
  }

  if (deal.status !== "PAYMENT_PENDING") {
    throw new AppError(
      "INVALID_STATUS",
      409,
      "The handoff code is available only while funds are secured",
    );
  }

  const code = generateCode();
  const expiresAt = new Date(
    Date.now() + env.HANDOFF_CODE_TTL_MINUTES * 60_000,
  );

  await prisma.deal.update({
    where: { id: deal.id },
    data: {
      handoffCodeHash: sha256Hex(code),
      handoffCodeExpiresAt: expiresAt,
      handoffAttempts: 0,
    },
  });

  return {
    code: formatCode(code),
    expiresAt: expiresAt.toISOString(),
  };
}

/**
 * Seller submits the handoff code. On a correct, unexpired code within the
 * attempt limit, the deal completes atomically: funds are released via payout,
 * the transaction is marked SUCCEEDED (released), the deal is COMPLETED with a
 * history entry, and completedAt is set. Wrong attempts are counted and the
 * code is voided after the limit.
 */
export async function completeHandoff(
  dealId: string,
  userId: string,
  submittedCode: string,
) {
  const deal = await participantDeal(dealId, userId);

  if (deal.sellerId !== userId) {
    throw new AppError("FORBIDDEN", 403, "Only the seller can enter the handoff code");
  }

  if (deal.status !== "PAYMENT_PENDING") {
    throw new AppError(
      "INVALID_STATUS",
      409,
      "This deal is not awaiting handoff",
    );
  }

  if (!deal.handoffCodeHash || !deal.handoffCodeExpiresAt) {
    throw new AppError(
      "NO_HANDOFF_CODE",
      409,
      "The buyer has not revealed a handoff code yet",
    );
  }

  if (deal.handoffCodeExpiresAt.getTime() <= Date.now()) {
    throw new AppError("HANDOFF_CODE_EXPIRED", 410, "The handoff code expired");
  }

  if (deal.handoffAttempts >= env.HANDOFF_MAX_ATTEMPTS) {
    throw new AppError(
      "HANDOFF_ATTEMPTS_EXCEEDED",
      429,
      "Too many wrong attempts. Ask the buyer for a new code.",
    );
  }

  const normalized = submittedCode.replace(/\s/g, "");
  const matches =
    /^\d{6}$/.test(normalized) &&
    sha256Hex(normalized) === deal.handoffCodeHash;

  if (!matches) {
    const attempts = await prisma.deal.update({
      where: { id: deal.id },
      data: { handoffAttempts: { increment: 1 } },
      select: { handoffAttempts: true },
    });
    const remaining = Math.max(0, env.HANDOFF_MAX_ATTEMPTS - attempts.handoffAttempts);

    throw new AppError(
      "INVALID_HANDOFF_CODE",
      400,
      remaining > 0
        ? `Incorrect code. ${remaining} attempts remaining.`
        : "Incorrect code. Ask the buyer for a new code.",
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.deal.findUnique({ where: { id: deal.id } });

    if (!current || current.status !== "PAYMENT_PENDING") {
      throw new AppError("INVALID_STATUS", 409, "This deal is no longer awaiting handoff");
    }

    const transaction = await tx.transaction.findFirst({
      where: { dealId: deal.id },
    });

    if (!transaction) {
      throw new AppError("NOT_FOUND", 404, "Transaction not found");
    }

    // Release funds to the seller's connected account.
    await testPaymentProvider.payout(transaction.providerPaymentId, transaction.amountCents - transaction.feeCents);

    await tx.ledgerEntry.create({
      data: {
        transactionId: transaction.id,
        type: "PAYOUT",
        amountCents: transaction.amountCents - transaction.feeCents,
        currency: transaction.currency,
        reference: `payout:${deal.id}`,
      },
    });

    const updated = await tx.deal.update({
      where: { id: deal.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        handoffCodeHash: null,
        handoffCodeExpiresAt: null,
      },
    });

    await tx.dealHistory.create({
      data: {
        dealId: deal.id,
        fromStatus: "PAYMENT_PENDING",
        toStatus: "COMPLETED",
        note: "Handoff code verified; funds released to seller",
      },
    });

    return updated;
  });

  try {
    const completedDeal = await prisma.deal.findUnique({
      where: { id: deal.id },
      select: { buyerId: true, sellerId: true, listing: { select: { title: true } } },
    });

    if (completedDeal) {
      for (const recipientId of [completedDeal.buyerId, completedDeal.sellerId]) {
        await notifyDealEvent({
          dealId: deal.id,
          event: "handoff_completed",
          recipientId,
          listingTitle: completedDeal.listing.title,
        });
      }
    }
  } catch (error) {
    logger.error({ err: error }, "could not send handoff-completed notifications");
  }

  return { id: result.id, status: result.status };
}
