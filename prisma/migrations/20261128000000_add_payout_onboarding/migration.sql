-- Payout onboarding state for sellers. The account id is gateway-private and
-- never serialized to clients.
ALTER TABLE "users"
  ADD COLUMN "payout_onboarded_at" TIMESTAMPTZ(3),
  ADD COLUMN "payout_account_id" VARCHAR(200);
