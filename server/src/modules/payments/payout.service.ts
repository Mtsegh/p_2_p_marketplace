import { prisma } from "../../db/prisma.js";
import { AppError } from "../../lib/app-error.js";
import { testPaymentProvider } from "./payment.provider.js";
import type { OnboardInput } from "./payout.schemas.js";

/**
 * Onboards the seller for payouts. The gateway creates a connected account;
 * we store its id privately and record onboarding time. Repeat calls are
 * idempotent — an already-onboarded seller just gets their status back.
 */
export async function onboardSeller(userId: string, input: OnboardInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, payoutOnboardedAt: true, payoutAccountId: true },
  });

  if (!user) {
    throw AppError.notFound("User not found");
  }

  if (user.payoutOnboardedAt && user.payoutAccountId) {
    return { onboarded: true, accountId: user.payoutAccountId };
  }

  const account = await testPaymentProvider.createPayoutAccount({
    userId,
    email: user.email,
    country: input.country,
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      payoutAccountId: account.accountId,
      payoutOnboardedAt: new Date(),
    },
  });

  return { onboarded: true, accountId: account.accountId };
}

/** Payout status is safe to expose; the gateway account id is not. */
export async function getPayoutStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { payoutOnboardedAt: true },
  });

  return {
    onboarded: Boolean(user?.payoutOnboardedAt),
    onboardedAt: user?.payoutOnboardedAt?.toISOString() ?? null,
  };
}

/** Used by the deal service: true when the seller can receive a payout. */
export async function sellerCanReceivePayout(sellerId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { payoutOnboardedAt: true },
  });

  return Boolean(user?.payoutOnboardedAt);
}
