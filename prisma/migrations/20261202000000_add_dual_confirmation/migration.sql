-- Dual confirmation for exchange handoffs.
ALTER TABLE "deals"
  ADD COLUMN "buyer_confirmed_at" TIMESTAMPTZ(3),
  ADD COLUMN "seller_confirmed_at" TIMESTAMPTZ(3);
