"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/text-field";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  fetchAdminUsers,
  fetchAdminListings,
  fetchAudit,
  fetchSettings,
  moderateListing,
  setUserStatus,
  updateSettings,
  type PlatformSettings,
} from "@/lib/admin-api";
import {
  fetchDisputes,
  resolveDispute,
  RESOLUTION_LABELS,
  type Dispute,
} from "@/lib/disputes-api";

type Tab = "users" | "listings" | "disputes" | "settings" | "audit";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "users", label: "Users" },
  { key: "listings", label: "Listings" },
  { key: "disputes", label: "Disputes" },
  { key: "settings", label: "Settings" },
  { key: "audit", label: "Audit log" },
];

function UsersPanel() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const query = useInfiniteQuery({
    queryKey: ["admin", "users", search],
    queryFn: ({ pageParam }) => fetchAdminUsers({ q: search || undefined, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "ACTIVE" | "SUSPENDED" }) =>
      setUserStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  const users = query.data?.pages.flatMap((page) => page.users) ?? [];
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <TextField
        label="Search users by email"
        type="search"
        placeholder="person@example.com"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {mutation.isError ? (
        <Alert tone="danger" title="Could not update the user">
          {mutation.error instanceof ApiError ? mutation.error.message : "Try again."}
        </Alert>
      ) : null}
      {query.isLoading ? <p className="text-muted">Loading…</p> : null}
      {users.length === 0 && !query.isLoading ? (
        <EmptyState title="No users found" description="Try a different search." />
      ) : null}
      <ul className="flex flex-col gap-3">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{user.displayName || "Marketplace member"}</p>
              <p className="truncate text-sm text-muted">{user.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={user.status === "ACTIVE" ? "success" : "warning"}>
                {user.status}
              </Badge>
              {confirmId === user.id ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    loading={mutation.isPending}
                    onClick={() => {
                      mutation.mutate({ id: user.id, status: "SUSPENDED" });
                      setConfirmId(null);
                    }}
                  >
                    Confirm suspend
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : user.status === "ACTIVE" ? (
                <Button size="sm" variant="secondary" onClick={() => setConfirmId(user.id)}>
                  Suspend
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ id: user.id, status: "ACTIVE" })}
                >
                  Reactivate
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
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

function ListingsPanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("");

  const query = useInfiniteQuery({
    queryKey: ["admin", "listings", status],
    queryFn: ({ pageParam }) =>
      fetchAdminListings({ status: (status || undefined) as never, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "remove" | "restore" }) =>
      moderateListing(id, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "listings"] }),
  });

  const listings = query.data?.pages.flatMap((page) => page.listings) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="w-56">
        <TextField
          label="Filter by status"
          placeholder="e.g. ACTIVE"
          value={status}
          onChange={(event) => setStatus(event.target.value.toUpperCase())}
        />
      </div>
      {mutation.isError ? (
        <Alert tone="danger" title="Could not moderate the listing">
          {mutation.error instanceof ApiError ? mutation.error.message : "Try again."}
        </Alert>
      ) : null}
      {listings.length === 0 && !query.isLoading ? (
        <EmptyState title="No listings" description="Nothing matches this status." />
      ) : null}
      <ul className="flex flex-col gap-3">
        {listings.map((listing) => (
          <li
            key={listing.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{listing.title}</p>
              <p className="text-xs text-muted">Owner: {listing.ownerId}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={listing.status === "ACTIVE" ? "success" : "neutral"}>
                {listing.status}
              </Badge>
              {listing.status === "REMOVED" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ id: listing.id, action: "restore" })}
                >
                  Restore
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  loading={mutation.isPending}
                  onClick={() => mutation.mutate({ id: listing.id, action: "remove" })}
                >
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
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

function SettingsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "settings"], queryFn: fetchSettings });
  const [fee, setFee] = useState<string | null>(null);
  const [windowDays, setWindowDays] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: Partial<PlatformSettings>) => updateSettings(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      setSaved(true);
    },
  });

  if (query.isLoading) return <p className="text-muted">Loading settings…</p>;
  if (!query.data) return <Alert tone="danger" title="Could not load settings" />;

  const settings = query.data;

  return (
    <div className="flex max-w-md flex-col gap-4">
      {saved ? <Alert tone="success" title="Settings saved" /> : null}
      <TextField
        label="Platform fee (basis points)"
        type="number"
        min="0"
        max="5000"
        value={fee ?? String(settings.platformFeeBps)}
        onChange={(event) => {
          setFee(event.target.value);
          setSaved(false);
        }}
        hint="100 = 1%. Maximum 5000 (50%)."
      />
      <TextField
        label="Escrow window (days)"
        type="number"
        min="1"
        max="90"
        value={windowDays ?? String(settings.escrowWindowDays)}
        onChange={(event) => {
          setWindowDays(event.target.value);
          setSaved(false);
        }}
        hint="Days before secured funds are auto-refunded."
      />
      <div>
        <Button
          loading={mutation.isPending}
          disabled={mutation.isPending}
          onClick={() =>
            mutation.mutate({
              platformFeeBps: Number(fee ?? settings.platformFeeBps),
              escrowWindowDays: Number(windowDays ?? settings.escrowWindowDays),
            })
          }
        >
          Save settings
        </Button>
      </div>
      {mutation.isError ? (
        <Alert tone="danger" title="Could not save settings">
          {mutation.error instanceof ApiError ? mutation.error.message : "Try again."}
        </Alert>
      ) : null}
    </div>
  );
}

function AuditPanel() {
  const query = useInfiniteQuery({
    queryKey: ["admin", "audit"],
    queryFn: ({ pageParam }) => fetchAudit(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const events = query.data?.pages.flatMap((page) => page.events) ?? [];

  return (
    <div className="flex flex-col gap-4">
      {query.isLoading ? <p className="text-muted">Loading…</p> : null}
      {events.length === 0 && !query.isLoading ? (
        <EmptyState title="No actions yet" description="Admin actions will appear here." />
      ) : null}
      <ul className="flex flex-col gap-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-lg border border-line bg-surface p-4 text-sm"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{event.action}</span>
              <time className="text-xs text-muted">
                {new Date(event.createdAt).toLocaleString("en-US")}
              </time>
            </div>
            <p className="mt-1 text-xs text-muted">
              {event.targetType}: {event.targetId} · by {event.actorId}
            </p>
            {event.after ? (
              <pre className="mt-2 overflow-x-auto rounded bg-surface-raised p-2 text-xs">
                {JSON.stringify(event.after)}
              </pre>
            ) : null}
          </li>
        ))}
      </ul>
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

function DisputesPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "disputes"], queryFn: fetchDisputes });
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState<"RELEASE" | "REFUND" | "SPLIT">("REFUND");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => resolveDispute(selected!.id, resolution, note || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "disputes"] });
      setSelected(null);
      setNote("");
    },
  });

  if (query.isLoading) return <p className="text-muted">Loading disputes…</p>;

  const disputes = query.data ?? [];
  const open = disputes.filter((dispute) => dispute.status === "OPEN");

  return (
    <div className="flex flex-col gap-4">
      {mutation.isError ? (
        <Alert tone="danger" title="Could not resolve the dispute">
          {mutation.error instanceof ApiError ? mutation.error.message : "Try again."}
        </Alert>
      ) : null}

      {open.length === 0 ? (
        <EmptyState title="No open disputes" description="New disputes will appear here." />
      ) : null}

      <ul className="flex flex-col gap-3">
        {open.map((dispute) => (
          <li
            key={dispute.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-line bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Deal: {dispute.dealId}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">
                {dispute.reason}
              </p>
              <p className="mt-1 text-xs text-muted">
                Opened by {dispute.openedById} ·{" "}
                {new Date(dispute.createdAt).toLocaleString("en-US")}
              </p>
            </div>
            <div className="w-full sm:w-56">
              {selected?.id === dispute.id ? (
                <div className="flex flex-col gap-2">
                  <select
                    aria-label="Resolution"
                    value={resolution}
                    onChange={(event) =>
                      setResolution(event.target.value as typeof resolution)
                    }
                    className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm"
                  >
                    {(Object.keys(RESOLUTION_LABELS) as Array<keyof typeof RESOLUTION_LABELS>).map(
                      (key) => (
                        <option key={key} value={key}>
                          {RESOLUTION_LABELS[key]}
                        </option>
                      ),
                    )}
                  </select>
                  <TextField
                    label="Note (optional)"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="danger"
                      loading={mutation.isPending}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate()}
                    >
                      Resolve
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setSelected(dispute)}>
                  Review
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (user?.role !== "ADMIN") {
    return (
      <EmptyState
        title="Administrators only"
        description="You do not have access to the admin dashboard."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              tab === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-surface-raised text-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "users" ? <UsersPanel /> : null}
      {tab === "listings" ? <ListingsPanel /> : null}
      {tab === "disputes" ? <DisputesPanel /> : null}
      {tab === "settings" ? <SettingsPanel /> : null}
      {tab === "audit" ? <AuditPanel /> : null}
    </div>
  );
}
