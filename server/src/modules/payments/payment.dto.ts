import type { Transaction } from "../../generated/prisma/client.js";
import type { TransactionStatus } from "../../generated/prisma/enums.js";

export interface TransactionDto {
  id: string;
  dealId: string;
  provider: string;
  amountCents: number;
  feeCents: number;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
}

export function toTransactionDto(tx: Transaction): TransactionDto {
  return {
    id: tx.id,
    dealId: tx.dealId,
    provider: tx.provider,
    amountCents: tx.amountCents,
    feeCents: tx.feeCents,
    currency: tx.currency,
    status: tx.status,
    createdAt: tx.createdAt.toISOString(),
  };
}
