-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "provider_payment_id" VARCHAR(200) NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "fee_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider_event_id" VARCHAR(200) NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transactions_provider_payment_id_key" ON "transactions"("provider_payment_id");
CREATE INDEX "transactions_deal_id_idx" ON "transactions"("deal_id");
CREATE INDEX "transactions_status_idx" ON "transactions"("status");
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider_event_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
