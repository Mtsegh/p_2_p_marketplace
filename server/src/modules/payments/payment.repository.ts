import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import type { TransactionStatus } from "../../generated/prisma/enums.js";

const TRANSACTION_SELECT = {
  id: true,
  dealId: true,
  provider: true,
  providerPaymentId: true,
  amountCents: true,
  feeCents: true,
  currency: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Creates a pending transaction and records the deal's state-change history. */
export function createTransaction(input: {
  dealId: string;
  provider: string;
  providerPaymentId: string;
  amountCents: number;
  feeCents: number;
  currency: string;
}) {
  return prisma.transaction.create({
    data: { ...input, status: "PENDING" },
    select: TRANSACTION_SELECT,
  });
}

export function findTransactionByPaymentId(providerPaymentId: string) {
  return prisma.transaction.findUnique({
    where: { providerPaymentId },
    select: TRANSACTION_SELECT,
  });
}

/** Finds a transaction for a deal (used by the status endpoint). */
export function findTransactionForDeal(dealId: string) {
  return prisma.transaction.findFirst({
    where: { dealId },
    orderBy: { createdAt: "desc" },
    select: TRANSACTION_SELECT,
  });
}

/**
 * Applies a successful webhook idempotently: records the event and, only if
 * the event is new, marks the transaction SUCCEEDED. Returns whether the event
 * was newly recorded. The caller runs this whole thing in one transaction.
 */
export async function applySucceededEvent(
  tx: Prisma.TransactionClient,
  input: {
    providerEventId: string;
    provider: string;
    type: string;
    payload: object;
    providerPaymentId: string;
  },
): Promise<{ alreadyProcessed: boolean; transaction: { id: string; dealId: string } | null }> {
  // The unique index on provider_event_id makes duplicate detection atomic.
  const existing = await tx.webhookEvent.findUnique({
    where: { providerEventId: input.providerEventId },
  });

  if (existing) {
    return { alreadyProcessed: true, transaction: null };
  }

  await tx.webhookEvent.create({
    data: {
      providerEventId: input.providerEventId,
      provider: input.provider,
      type: input.type,
      payload: input.payload as object,
    },
  });

  const transaction = await tx.transaction.update({
    where: { providerPaymentId: input.providerPaymentId },
    data: { status: "SUCCEEDED" as TransactionStatus },
    select: { id: true, dealId: true },
  });

  return { alreadyProcessed: false, transaction };
}

export function listTransactionsForUser(userId: string) {
  return prisma.transaction.findMany({
    where: {
      deal: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    },
    orderBy: { createdAt: "desc" },
    select: TRANSACTION_SELECT,
  });
}
