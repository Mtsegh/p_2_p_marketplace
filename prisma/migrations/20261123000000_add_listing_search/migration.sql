-- Full-text search for listing titles and descriptions.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- A generated tsvector column: PostgreSQL keeps it in sync on every INSERT/UPDATE.
-- 'A' weights the title higher than the description, so title matches rank first.
ALTER TABLE "listings"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B')
  ) STORED;

-- GIN index powers the @@ full-text operator and ts_rank ordering.
CREATE INDEX "listings_search_vector_idx" ON "listings" USING gin ("search_vector");

-- Trigram indexes back case-insensitive substring filters used by location and
-- keyword fallback (ILIKE '%...%'), which a btree index cannot accelerate.
CREATE INDEX "listings_title_trgm_idx" ON "listings" USING gin ("title" gin_trgm_ops);
CREATE INDEX "listings_description_trgm_idx" ON "listings" USING gin ("description" gin_trgm_ops);
CREATE INDEX "listings_location_trgm_idx" ON "listings" USING gin ("location" gin_trgm_ops);

-- Composite index for the default sort (active listings, newest first) and a
-- standalone price index for the price sort and range filters.
CREATE INDEX "listings_status_created_idx" ON "listings" ("status", "created_at" DESC, "id" DESC);
CREATE INDEX "listings_price_cents_idx" ON "listings" ("price_cents");
