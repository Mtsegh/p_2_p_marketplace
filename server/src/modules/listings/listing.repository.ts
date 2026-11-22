import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../db/prisma.js";
import type {
  ListingCondition,
  ListingStatus,
  ListingType,
} from "../../generated/prisma/client.js";
import type { ListListingsQuery } from "./listing.schemas.js";
import type { ListingWithRelations } from "./listing.dto.js";

/**
 * Every listing read includes the same relations so `toListingDto` can always
 * rely on `owner`, `category`, and `images` being present. An earlier version
 * omitted images from the list queries while the DTO mapped them, which made
 * the public browse endpoint throw a 500.
 */
const LISTING_INCLUDE = {
  owner: { select: { id: true, profile: true } },
  category: { select: { id: true, name: true, slug: true } },
  images: {
    select: {
      id: true,
      key: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      width: true,
      height: true,
      position: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { position: "asc" as const },
  },
} as const;

/**
 * Data access for listings. Services own business rules; this module only talks
 * to Prisma and keeps transaction handling close to the writes that must be
 * atomic.
 */

export function createListing(data: {
  ownerId: string;
  categoryId: string | null;
  title: string;
  description: string;
  condition: ListingCondition;
  priceCents: number | null;
  listingType: ListingType;
  status: ListingStatus;
  location: string;
}) {
  return prisma.listing.create({
    data: {
      owner: { connect: { id: data.ownerId } },
      ...(data.categoryId ? { category: { connect: { id: data.categoryId } } } : {}),
      title: data.title,
      description: data.description,
      condition: data.condition,
      priceCents: data.priceCents,
      listingType: data.listingType,
      status: data.status,
      location: data.location,
    },
    include: LISTING_INCLUDE,
  });
}

export function findListingById(listingId: string) {
  return prisma.listing.findUnique({
    where: { id: listingId },
    include: LISTING_INCLUDE,
  });
}

export function updateListing(
  listingId: string,
  data: Partial<{
    title: string;
    description: string;
    condition: ListingCondition;
    priceCents: number | null;
    listingType: ListingType;
    status: ListingStatus;
    categoryId: string | null;
    location: string;
  }>,
) {
  return prisma.listing.update({
    where: { id: listingId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.condition !== undefined && { condition: data.condition }),
      ...(data.priceCents !== undefined && { priceCents: data.priceCents }),
      ...(data.listingType !== undefined && { listingType: data.listingType }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.categoryId !== undefined && {
        category: data.categoryId
          ? { connect: { id: data.categoryId } }
          : { disconnect: true },
      }),
      ...(data.location !== undefined && { location: data.location }),
    },
    include: LISTING_INCLUDE,
  });
}

export function deleteListing(listingId: string) {
  return prisma.listing.delete({
    where: { id: listingId },
  });
}

/**
 * Opaque pagination token. Encodes the sort key of the last row on the page so
 * the next request can resume at the right position for ANY sort. An id alone
 * is not enough when ordering by price or full-text rank.
 */
interface SearchCursor {
  s: number; // sort key value
  i: string; // listing id, the tiebreaker
}

function encodeCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(token?: string): SearchCursor | null {
  if (!token) return null;

  try {
    const value = JSON.parse(
      Buffer.from(token, "base64url").toString("utf8"),
    ) as SearchCursor;

    if (
      typeof value?.s === "number" &&
      Number.isFinite(value.s) &&
      typeof value?.i === "string"
    ) {
      return value;
    }
  } catch {
    // A malformed cursor simply starts from the beginning.
  }

  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ListActiveResult {
  listings: ListingWithRelations[];
  nextCursor: string | null;
  total: number;
}

/**
 * Lists active (publicly visible) listings with full-text search, filters,
 * sorting, and keyset pagination. Prisma 7 cannot express `@@` in its generated
 * types, so the matching ids and sort keys come from a fully parameterized raw
 * SQL query; the page is then hydrated through Prisma so the DTO mapping still
 * gets owner/category/images relations.
 */
export async function listActiveListings(
  query: ListListingsQuery,
): Promise<ListActiveResult> {
  const conditions: Prisma.Sql[] = [Prisma.sql`l.status = 'ACTIVE'`];

  // category may be a UUID (current client) or a slug (pretty URL).
  if (query.category) {
    conditions.push(
      UUID_RE.test(query.category)
        ? Prisma.sql`l.category_id = ${query.category}::uuid`
        : Prisma.sql`l.category_id IN (SELECT id FROM categories WHERE slug = ${query.category})`,
    );
  }
  if (query.condition) {
    conditions.push(Prisma.sql`l.condition::text = ${query.condition}`);
  }
  if (query.listingType) {
    conditions.push(Prisma.sql`l.listing_type::text = ${query.listingType}`);
  }
  if (query.minPrice !== undefined) {
    conditions.push(Prisma.sql`l.price_cents >= ${query.minPrice}`);
  }
  if (query.maxPrice !== undefined) {
    conditions.push(Prisma.sql`l.price_cents <= ${query.maxPrice}`);
  }
  if (query.location) {
    // pg_trgm index backs this leading-wildcard ILIKE.
    conditions.push(Prisma.sql`l.location ILIKE '%' || ${query.location} || '%'`);
  }
  if (query.q) {
    // Full-text match on the indexed tsvector, plus ILIKE so partial words
    // ("cam" -> "camera") still return results, backed by trgm indexes.
    conditions.push(Prisma.sql`(
      l.search_vector @@ websearch_to_tsquery('english', ${query.q})
      OR l.title ILIKE '%' || ${query.q} || '%'
      OR l.description ILIKE '%' || ${query.q} || '%'
    )`);
  }

  const where = Prisma.join(conditions, " AND ");

  const ascending = query.sort === "price_asc";
  const direction = ascending ? Prisma.raw("ASC") : Prisma.raw("DESC");

  // A single numeric sort key for every sort mode keeps the keyset predicate
  // uniform. Null prices sort last in both directions.
  const sortKey =
    query.sort === "price_asc"
      ? Prisma.sql`COALESCE(l.price_cents, 2147483647)::float8`
      : query.sort === "price_desc"
        ? Prisma.sql`COALESCE(l.price_cents, -1)::float8`
        : query.sort === "relevance"
          ? Prisma.sql`ts_rank(l.search_vector, websearch_to_tsquery('english', ${query.q ?? ""}))::float8`
          : Prisma.sql`EXTRACT(EPOCH FROM l.created_at)::float8`;

  const cursor = decodeCursor(query.cursor);
  const keyset = cursor
    ? Prisma.sql`(${sortKey}, l.id) ${ascending ? Prisma.raw(">") : Prisma.raw("<")} (${cursor.s}::float8, ${cursor.i}::uuid)`
    : Prisma.sql`TRUE`;

  const rows = await prisma.$queryRaw<Array<{ id: string; sortkey: number }>>(
    Prisma.sql`
      SELECT l.id::text AS id, ${sortKey} AS sortkey
      FROM listings l
      WHERE ${where} AND ${keyset}
      ORDER BY ${sortKey} ${direction}, l.id ${direction}
      LIMIT ${query.limit + 1}
    `,
  );

  const countRows = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`SELECT COUNT(*)::bigint AS count FROM listings l WHERE ${where}`,
  );
  const total = Number(countRows[0]?.count ?? 0n);

  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
  const ids = pageRows.map((row) => row.id);

  let listings: ListingWithRelations[] = [];

  if (ids.length > 0) {
    const found = await prisma.listing.findMany({
      where: { id: { in: ids } },
      include: LISTING_INCLUDE,
    });
    const byId = new Map(found.map((listing) => [listing.id, listing]));
    listings = ids
      .map((id) => byId.get(id))
      .filter(Boolean) as ListingWithRelations[];
  }

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({ s: Number(last.sortkey), i: last.id })
      : null;

  return { listings, nextCursor, total };
}

/**
 * Lists all listings for a specific owner, including drafts. Used by the
 * owner's own listing management pages.
 */
export function listListingsByOwner(
  ownerId: string,
  { limit, cursor }: { limit: number; cursor?: string },
) {
  return prisma.listing.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: LISTING_INCLUDE,
  });
}

export function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { listings: { where: { status: "ACTIVE" } } } },
    },
  });
}

export function createCategory(data: { name: string; slug: string }) {
  return prisma.category.create({
    data,
  });
}
