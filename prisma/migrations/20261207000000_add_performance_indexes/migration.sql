-- Composite indexes for the most common paginated and filtered queries.
-- Each supports a WHERE on the leading column(s) plus an ORDER BY created_at.

-- Public profile reviews: subject + newest first.
CREATE INDEX "reviews_subject_created_idx" ON "reviews"("subject_id", "created_at" DESC);

-- Admin moderation queues.
CREATE INDEX "reports_status_created_idx" ON "reports"("status", "created_at" DESC);
CREATE INDEX "disputes_status_created_idx" ON "disputes"("status", "created_at" DESC);

-- A user's own deals, filtered by role and newest first.
CREATE INDEX "deals_buyer_created_idx" ON "deals"("buyer_id", "created_at" DESC);
CREATE INDEX "deals_seller_created_idx" ON "deals"("seller_id", "created_at" DESC);

-- A seller's own listings, newest first.
CREATE INDEX "listings_owner_created_idx" ON "listings"("owner_id", "created_at" DESC);

-- Latest transaction for a deal.
CREATE INDEX "transactions_deal_created_idx" ON "transactions"("deal_id", "created_at" DESC);

-- Ledger lookups by transaction and entry type.
CREATE INDEX "ledger_entries_transaction_type_idx" ON "ledger_entries"("transaction_id", "type");
