"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { fetchDeals } from "@/lib/deals-api";

export type DealRole = "buyer" | "seller";

/**
 * Infinite list of the signed-in user's deals, filtered by role. The query key
 * includes the role so switching tabs fetches the right set from page one.
 */
export function useDeals(role: DealRole) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["deals", role, user?.id],
    queryFn: ({ pageParam }) =>
      fetchDeals({ role, limit: 20, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(user),
  });
}
