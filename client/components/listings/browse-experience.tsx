"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import {
  activeFilterCount,
  buildBrowseUrl,
  DEFAULT_FILTERS,
  filtersKey,
  type BrowseFilters,
} from "@/lib/browse-filters";
import type {
  Category,
  ListingCondition,
  ListingType,
  ListListingsResult,
} from "@/lib/listings-api";
import { BrowseGrid } from "./browse-grid";

const CONDITIONS: ListingCondition[] = [
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "FAIR",
  "POOR",
];

const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: "New",
  LIKE_NEW: "Like new",
  GOOD: "Good",
  FAIR: "Fair",
  POOR: "Poor",
};

const TYPES: ListingType[] = ["SALE", "EXCHANGE", "BOTH"];
const TYPE_LABELS: Record<ListingType, string> = {
  SALE: "Sale",
  EXCHANGE: "Swap",
  BOTH: "Sale or Swap",
};

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "relevance", label: "Most relevant" },
] as const;

function FilterFields({
  draft,
  categories,
  onChange,
}: {
  draft: BrowseFilters;
  categories: Category[];
  onChange: (patch: Partial<BrowseFilters>) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Select
        label="Category"
        value={draft.category}
        onChange={(event) => onChange({ category: event.target.value })}
      >
        <option value="">All categories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </Select>

      <Select
        label="Condition"
        value={draft.condition}
        onChange={(event) =>
          onChange({ condition: event.target.value as ListingCondition | "" })
        }
      >
        <option value="">Any condition</option>
        {CONDITIONS.map((condition) => (
          <option key={condition} value={condition}>
            {CONDITION_LABELS[condition]}
          </option>
        ))}
      </Select>

      <Select
        label="Listing type"
        value={draft.listingType}
        onChange={(event) =>
          onChange({ listingType: event.target.value as ListingType | "" })
        }
      >
        <option value="">All types</option>
        {TYPES.map((type) => (
          <option key={type} value={type}>
            {TYPE_LABELS[type]}
          </option>
        ))}
      </Select>

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Min price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="0"
          value={draft.minPrice}
          onChange={(event) => onChange({ minPrice: event.target.value })}
        />
        <TextField
          label="Max price"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder="Any"
          value={draft.maxPrice}
          onChange={(event) => onChange({ maxPrice: event.target.value })}
        />
      </div>

      <TextField
        label="Location"
        type="search"
        placeholder="e.g. Lagos"
        value={draft.location}
        onChange={(event) => onChange({ location: event.target.value })}
      />
    </div>
  );
}

/**
 * Owns the browse filter UI. All state lives in a local draft and is committed
 * to the URL after a 300ms debounce, so links are shareable and the back button
 * restores a previous search. The server re-renders with the new search params
 * and hands down the matching first page.
 */
export function BrowseExperience({
  filters,
  categories,
  initialPage,
}: {
  filters: BrowseFilters;
  categories: Category[];
  initialPage: ListListingsResult;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const [draft, setDraft] = useState<BrowseFilters>(filters);
  const currentUrlRef = useRef(buildBrowseUrl(filters));
  const serverKeyRef = useRef(filtersKey(filters));

  const serverKey = filtersKey(filters);

  // When navigation (or back/forward) changes the URL, adopt the server's view
  // of the filters so the controls stay in sync.
  useEffect(() => {
    if (serverKey !== serverKeyRef.current) {
      serverKeyRef.current = serverKey;
      setDraft(filters);
      currentUrlRef.current = buildBrowseUrl(filters);
    }
  }, [serverKey, filters]);

  // Debounce all filter changes into a single URL update.
  useEffect(() => {
    const timer = setTimeout(() => {
      const url = buildBrowseUrl(draft);

      if (url === currentUrlRef.current) {
        return;
      }

      currentUrlRef.current = url;
      startTransition(() => router.replace(url, { scroll: false }));
    }, 300);

    return () => clearTimeout(timer);
  }, [draft, router]);

  function onChange(patch: Partial<BrowseFilters>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function clearFilters() {
    setDraft({
      ...DEFAULT_FILTERS,
      sort: draft.sort,
    });
  }

  const chips: Array<{ label: string; clear: () => void }> = [];

  if (draft.q.trim()) {
    chips.push({
      label: `“${draft.q.trim()}”`,
      clear: () => onChange({ q: "" }),
    });
  }
  if (draft.category) {
    const category = categories.find((item) => item.slug === draft.category);

    chips.push({
      label: category?.name ?? draft.category,
      clear: () => onChange({ category: "" }),
    });
  }
  if (draft.condition) {
    chips.push({
      label: CONDITION_LABELS[draft.condition],
      clear: () => onChange({ condition: "" }),
    });
  }
  if (draft.listingType) {
    chips.push({
      label: TYPE_LABELS[draft.listingType],
      clear: () => onChange({ listingType: "" }),
    });
  }
  if (draft.minPrice || draft.maxPrice) {
    chips.push({
      label: `Price ${draft.minPrice || "0"}–${draft.maxPrice || "any"}`,
      clear: () => onChange({ minPrice: "", maxPrice: "" }),
    });
  }
  if (draft.location.trim()) {
    chips.push({
      label: draft.location.trim(),
      clear: () => onChange({ location: "" }),
    });
  }

  // Pass the committed URL filters to the grid, not the uncommitted draft: the
  // first page from the server matches `filters`, so the query key must match it.
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField
            label="Search listings"
            type="search"
            placeholder="Try “vintage camera”"
            value={draft.q}
            onChange={(event) => onChange({ q: event.target.value })}
          />
        </div>
        <div className="sm:w-56">
          <Select
            label="Sort by"
            value={draft.sort}
            onChange={(event) =>
              onChange({ sort: event.target.value as BrowseFilters["sort"] })
            }
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </Select>
        </div>
        <Button
          variant="secondary"
          className="sm:hidden"
          onClick={() => setSheetOpen((open) => !open)}
          aria-expanded={sheetOpen}
        >
          {sheetOpen ? "Hide filters" : "Filters"}
          {activeFilterCount(draft) > 0
            ? ` (${activeFilterCount(draft)})`
            : ""}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="rounded-lg border border-line bg-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">Filters</h2>
              {activeFilterCount(draft) > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
                >
                  Clear all
                </button>
              ) : null}
            </div>
            <FilterFields
              draft={draft}
              categories={categories}
              onChange={onChange}
            />
          </div>
        </aside>

        {sheetOpen ? (
          <div className="rounded-lg border border-line bg-surface p-5 lg:hidden">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-medium">Filters</h2>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
              >
                Clear all
              </button>
            </div>
            <FilterFields
              draft={draft}
              categories={categories}
              onChange={onChange}
            />
          </div>
        ) : null}

        <div className="min-w-0">
          {chips.length > 0 ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button type="button" key={chip.label} onClick={chip.clear}>
                  <Badge tone="neutral">
                    {chip.label} <span aria-hidden="true">×</span>
                  </Badge>
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-muted underline underline-offset-2 hover:text-foreground"
              >
                Clear all
              </button>
            </div>
          ) : null}

          <BrowseGrid initialPage={initialPage} filters={filters} />
        </div>
      </div>
    </div>
  );
}
