-- Listings offered by the proposer in an exchange deal.
CREATE TABLE "deal_offered_listings" (
    "id" UUID NOT NULL,
    "deal_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,

    CONSTRAINT "deal_offered_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deal_offered_listings_deal_id_listing_id_key" ON "deal_offered_listings"("deal_id", "listing_id");
CREATE INDEX "deal_offered_listings_listing_id_idx" ON "deal_offered_listings"("listing_id");

ALTER TABLE "deal_offered_listings" ADD CONSTRAINT "deal_offered_listings_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "deal_offered_listings" ADD CONSTRAINT "deal_offered_listings_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
