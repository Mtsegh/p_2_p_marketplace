"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth";
import { DealCard } from "@/components/deals/deal-card";
import { useDeals, type DealRole } from "@/lib/use-deals";

function DealsList({ role }: { role: DealRole }) {
  const query = useDeals(role);
  const deals = query.data?.pages.flatMap((page) => page.deals) ?? [];

  if (query.isLoading) {
    return <p className="text-muted">Loading deals…</p>;
  }

  if (query.isError) {
    return (
      <Alert tone="danger" title="Could not load deals">
        Check your connection and try again.
      </Alert>
    );
  }

  if (deals.length === 0) {
    return (
      <EmptyState
        title={role === "buyer" ? "No offers sent" : "No offers received"}
        description={
          role === "buyer"
            ? "When you make an offer on a listing, it will appear here."
            : "When someone makes an offer on your listing, it will appear here."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          onChanged={() => query.refetch()}
        />
      ))}

      {query.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            onClick={() => query.fetchNextPage()}
            loading={query.isFetchingNextPage}
            disabled={query.isFetchingNextPage}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DealsView() {
  const { user, status } = useAuth();
  const [role, setRole] = useState<DealRole>("buyer");

  if (status === "loading") {
    return <p className="text-muted">Loading…</p>;
  }

  if (!user) {
    return (
      <EmptyState
        title="Sign in to see your deals"
        description="Your offers and proposals live here once you are signed in."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex gap-2"
        role="tablist"
        aria-label="Deal role"
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          setRole(role === "buyer" ? "seller" : "buyer");
        }}
      >
        {(["buyer", "seller"] as DealRole[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            id={`deal-tab-${option}`}
            aria-controls="deal-role-panel"
            aria-selected={role === option}
            tabIndex={role === option ? 0 : -1}
            onClick={() => setRole(option)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              role === option
                ? "bg-primary text-primary-foreground"
                : "bg-surface-raised text-muted"
            }`}
          >
            {option === "buyer" ? "Offers I sent" : "Offers received"}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="deal-role-panel"
        aria-labelledby={`deal-tab-${role}`}
        tabIndex={0}
      >
        <DealsList role={role} />
      </div>
    </div>
  );
}
