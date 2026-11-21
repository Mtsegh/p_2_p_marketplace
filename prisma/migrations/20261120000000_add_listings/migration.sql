-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('SALE', 'EXCHANGE', 'BOTH');

-- CreateEnum
CREATE TYPE "ListingCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'EXCHANGED', 'REMOVED');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "condition" "ListingCondition" NOT NULL DEFAULT 'GOOD',
    "price_cents" INTEGER,
    "listing_type" "ListingType" NOT NULL DEFAULT 'BOTH',
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "location" VARCHAR(200) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listings_owner_id_idx" ON "listings"("owner_id");
CREATE INDEX "listings_category_id_idx" ON "listings"("category_id");
CREATE INDEX "listings_status_idx" ON "listings"("status");
CREATE INDEX "listings_listing_type_idx" ON "listings"("listing_type");
CREATE INDEX "listings_condition_idx" ON "listings"("condition");
CREATE INDEX "listings_created_at_idx" ON "listings"("created_at");

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default categories
INSERT INTO "categories" ("id", "name", "slug", "created_at", "updated_at") VALUES
  ('00000000-0000-0000-0000-000000000001', 'Electronics', 'electronics', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000002', 'Furniture', 'furniture', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000003', 'Clothing', 'clothing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000004', 'Books', 'books', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000005', 'Sports & Outdoors', 'sports-outdoors', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000006', 'Home & Garden', 'home-garden', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000007', 'Vehicles', 'vehicles', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000008', 'Toys & Games', 'toys-games', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
