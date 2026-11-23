import { apiRequest, apiRequestJson } from "./api";

export type TransactionStatus =
  | "PENDING"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDED";

export interface CheckoutResult {
  checkoutUrl: string;
  amountCents: number;
  currency: string;
  provider: string;
}

export interface Transaction {
  id: string;
  dealId: string;
  provider: string;
  amountCents: number;
  feeCents: number;
  currency: string;
  status: TransactionStatus;
  createdAt: string;
}

/** Starts hosted checkout for an accepted sale deal (buyer only). */
export async function createCheckout(dealId: string): Promise<CheckoutResult> {
  const response = await apiRequestJson<{ data: CheckoutResult }>(
    "/api/v1/payments/checkout",
    "POST",
    { dealId },
  );

  return response.data;
}

/** Fetches the latest transaction for a deal. */
export async function fetchTransaction(dealId: string): Promise<Transaction | null> {
  try {
    const response = await apiRequest<{ data: { transaction: Transaction } }>(
      `/api/v1/payments/transaction?dealId=${encodeURIComponent(dealId)}`,
    );

    return response.data.transaction;
  } catch {
    return null;
  }
}

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}
