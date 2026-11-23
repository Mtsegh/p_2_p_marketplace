-- Escrow deadline on deals.
ALTER TABLE "deals" ADD COLUMN "escrow_expires_at" TIMESTAMPTZ(3);

-- Ledger of money movements.
CREATE TYPE "LedgerEntryType" AS ENUM ('HOLD', 'REFUND', 'PAYOUT');

CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "reference" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
