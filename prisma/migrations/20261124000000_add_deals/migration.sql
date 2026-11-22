-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('SALE', 'EXCHANGE');
CREATE TYPE "DealStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'PAYMENT_PENDING', 'COMPLETED', 'DISPUTED', 'RESOLVED');

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "type" "DealType" NOT NULL DEFAULT 'SALE',
    "amount_cents" INTEGER,
    "status" "DealStatus" NOT NULL DEFAULT 'PROPOSED',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_history" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "actor_id" UUID,
    "from_status" "DealStatus" NOT NULL,
    "to_status" "DealStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deals_listing_id_idx" ON "deals"("listing_id");
CREATE INDEX "deals_buyer_id_idx" ON "deals"("buyer_id");
CREATE INDEX "deals_seller_id_idx" ON "deals"("seller_id");
CREATE INDEX "deals_status_idx" ON "deals"("status");
CREATE INDEX "deal_history_deal_id_idx" ON "deal_history"("deal_id");

-- Only one deal per listing may be ACCEPTED at a time. Competing proposals are
-- rejected by the service when a deal is accepted, so this index is a safety
-- net that stops two concurrent accepts from both succeeding.
CREATE UNIQUE INDEX "deals_one_accepted_per_listing" ON "deals"("listing_id") WHERE "status" = 'ACCEPTED';

-- A buyer may only have one open proposal per listing at a time.
CREATE UNIQUE INDEX "deals_one_proposed_per_buyer_listing" ON "deals"("listing_id", "buyer_id") WHERE "status" = 'PROPOSED';

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deals" ADD CONSTRAINT "deals_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_history" ADD CONSTRAINT "deal_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
