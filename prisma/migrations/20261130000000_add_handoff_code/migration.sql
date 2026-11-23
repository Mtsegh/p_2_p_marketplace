-- One-time handoff code fields on deals. The code itself is never stored, only
-- its SHA-256 hash; expiry and attempt limits bound brute-force attempts.
ALTER TABLE "deals"
  ADD COLUMN "handoff_code_hash" VARCHAR(64),
  ADD COLUMN "handoff_code_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "handoff_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completed_at" TIMESTAMPTZ(3);
