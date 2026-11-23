import { prisma } from "../../db/prisma.js";
import { testPaymentProvider } from "./payment.provider.js";

/**
 * Finds deals whose secured funds have passed the escrow window and refunds
 * them automatically: refund via the gateway, mark the transaction REFUNDED,
 * move the deal to CANCELLED with a history entry, and record a REFUND ledger
 * entry. Each deal is processed once (status guard + unique ledger reference).
 *
 * This is called by a scheduler via a secret-protected endpoint; it is also
 * safe to call repeatedly.
 */
export async function processExpiredEscrows(now = new Date()) {
  const expired = await prisma.deal.findMany({
    where: {
      status: "PAYMENT_PENDING",
      escrowExpiresAt: { lte: now },
    },
    include: { transactions: true },
  });

  let processed = 0;

  for (const deal of expired) {
    const tx = deal.transactions[0];

    if (!tx) {
      continue;
    }

    await prisma.$transaction(async (db) => {
      // Re-check inside the transaction so concurrent runs cannot double-refund.
      const current = await db.deal.findUnique({ where: { id: deal.id } });

      if (!current || current.status !== "PAYMENT_PENDING") {
        return;
      }

      await testPaymentProvider.refund(tx.providerPaymentId, tx.amountCents);

      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "REFUNDED" },
      });

      await db.deal.update({
        where: { id: deal.id },
        data: { status: "CANCELLED" },
      });

      await db.dealHistory.create({
        data: {
          dealId: deal.id,
          fromStatus: "PAYMENT_PENDING",
          toStatus: "CANCELLED",
          note: "Escrow window expired; funds refunded to buyer",
        },
      });

      const already = await db.ledgerEntry.findFirst({
        where: { transactionId: tx.id, reference: `refund:${deal.id}` },
      });

      if (!already) {
        await db.ledgerEntry.create({
          data: {
            transactionId: tx.id,
            type: "REFUND",
            amountCents: tx.amountCents,
            currency: tx.currency,
            reference: `refund:${deal.id}`,
          },
        });
      }
    });

    processed += 1;
  }

  return { processed };
}
