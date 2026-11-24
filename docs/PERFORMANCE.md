# Performance notes

This document records the performance pass. Targets below are for staging with
production-like data; local development has a handful of rows and cannot prove
response-time goals.

## Query analysis and indexes

All list endpoints are paginated (cursor-based) and every column used in a
filter, sort, or join is indexed. To verify a hot query against staging data:

```sql
EXPLAIN ANALYZE
SELECT id, title FROM listings
WHERE status = 'ACTIVE' AND category_id = $1
ORDER BY created_at DESC, id DESC LIMIT 20;
```

The plan should use `listings_status_created_idx` (or the relevant partial/composite
index) and never a sequential scan over the whole table.

Indexes added in `20261207000000_add_performance_indexes`:

| Query | Index |
| ----- | ----- |
| Profile reviews, newest first | `reviews(subject_id, created_at DESC)` |
| Admin report/dispute queues by status | `reports(status, created_at DESC)`, `disputes(status, created_at DESC)` |
| A user's deals by role, newest first | `deals(buyer_id, created_at DESC)`, `deals(seller_id, created_at DESC)` |
| A seller's own listings | `listings(owner_id, created_at DESC)` |
| Latest transaction for a deal | `transactions(deal_id, created_at DESC)` |
| Ledger entries by type | `ledger_entries(transaction_id, type)` |

Earlier migrations already cover full-text search (`tsvector` GIN index),
`pg_trgm` substring filters, price sorting, and the high-traffic foreign keys.

Full-text search uses parameterized raw SQL only for id selection, then
hydrates one page through Prisma with a single query (`WHERE id IN (...)`), so
the browse page issues a constant number of queries regardless of page size.

## N+1 audit

Every read that maps DTOs includes its relations in the same Prisma query:

- Listings include `owner.profile`, `category`, and `images`.
- Deals include `listing`, both participants' profiles, `history`, and
  `offeredListings`.
- Categories use a `_count` subquery for active listings instead of loading
  every listing.
- Admin listing/deal overviews select scalar columns only.

No per-row database call remains in a list path.

## Caching

Hot, read-heavy data is cached in Redis through `src/lib/cache.ts`
(`cached` / `invalidateCache`). Cache failures are logged and fall back to the
database, so Redis is never a single point of failure for a read.

Categories are the first cached read (`cache:categories:v1`, 60s TTL). Because
that endpoint also returns an active-listing count, the entry is invalidated on
every change that can affect it:

- category creation (admin)
- listing create / update / delete / publish
- admin listing moderation (remove / restore)
- accepting a proposal (listing becomes RESERVED)
- resolving a report by removing a listing

Tests cover both the helper semantics and the end-to-end invalidation path
(`test/cache.test.ts`, `test/listings.test.ts`).

## Images

Listing images are uploaded directly to S3-compatible storage via presigned
URLs and served from the configured bucket/CDN. The image host is runtime
configuration, so it cannot be declared as a config-time `remotePattern` for
`next/image`; the gallery and cards therefore use plain `<img>` elements inside
fixed `aspect-ratio` containers, which reserve layout space and avoid cumulative
layout shift. The CDN is responsible for serving WebP/AVIF and appropriate
sizes. Re-encoding/EXIF stripping happens at upload time.

## Bundle and rendering

- App Router with server components by default; client components only where
  interactivity is required.
- Route-level code splitting is automatic; Next.js reports each route's first-
  load JS in `next build`.
- Cache Components + partial prerendering keep the static shell instant while
  dynamic data (feeds, deals, profiles) streams in.

## Open measurements (staging)

- Confirm p95 of `GET /api/v1/listings` with filters and `GET /listings/:id`
  under a basic load test.
- Check `EXPLAIN ANALYZE` on the browse and search queries with a realistic
  dataset and add/adjust indexes if a sequential scan appears.
- Review `next build` route bundle sizes and split any unusually large client
  component (e.g. the admin dashboard) if it becomes a bottleneck.
