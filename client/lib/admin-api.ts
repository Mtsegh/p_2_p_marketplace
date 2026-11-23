import { apiRequest, apiRequestJson } from "./api";
import type { UserRole, UserStatus } from "./auth-api";
import type { ListingStatus } from "./listings-api";

export interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  displayName: string;
  bio: string;
  location: string;
}

export interface AdminListing {
  id: string;
  title: string;
  ownerId: string;
  status: ListingStatus;
  priceCents: number | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface PlatformSettings {
  platformFeeBps: number;
  escrowWindowDays: number;
}

export async function fetchAdminUsers(params: {
  q?: string;
  cursor?: string;
} = {}): Promise<{ users: AdminUser[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.cursor) query.set("cursor", params.cursor);

  const response = await apiRequest<{
    data: { users: AdminUser[] };
    meta: { nextCursor: string | null };
  }>(`/api/v1/admin/users?${query.toString()}`);

  return { users: response.data.users, nextCursor: response.meta.nextCursor };
}

export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "SUSPENDED",
): Promise<AdminUser> {
  const response = await apiRequestJson<{ data: { user: AdminUser } }>(
    `/api/v1/admin/users/${encodeURIComponent(userId)}`,
    "PATCH",
    { status },
  );

  return response.data.user;
}

export async function fetchAdminListings(params: {
  status?: ListingStatus;
  cursor?: string;
} = {}): Promise<{ listings: AdminListing[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.cursor) query.set("cursor", params.cursor);

  const response = await apiRequest<{
    data: { listings: AdminListing[]; nextCursor: string | null };
  }>(`/api/v1/admin/listings?${query.toString()}`);

  return response.data;
}

export async function moderateListing(
  listingId: string,
  action: "remove" | "restore",
  reason?: string,
): Promise<{ id: string; title: string; status: ListingStatus }> {
  const response = await apiRequestJson<{
    data: { listing: { id: string; title: string; status: ListingStatus } };
  }>(`/api/v1/admin/listings/${encodeURIComponent(listingId)}`, "PATCH", {
    action,
    ...(reason ? { reason } : {}),
  });

  return response.data.listing;
}

export async function fetchSettings(): Promise<PlatformSettings> {
  const response = await apiRequest<{ data: { settings: PlatformSettings } }>(
    "/api/v1/admin/settings",
  );

  return response.data.settings;
}

export async function updateSettings(input: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const response = await apiRequestJson<{ data: { settings: PlatformSettings } }>(
    "/api/v1/admin/settings",
    "PATCH",
    input,
  );

  return response.data.settings;
}

export async function fetchAudit(cursor?: string): Promise<{
  events: AuditEvent[];
  nextCursor: string | null;
}> {
  const query = new URLSearchParams();
  if (cursor) query.set("cursor", cursor);

  const response = await apiRequest<{
    data: { events: AuditEvent[]; nextCursor: string | null };
  }>(`/api/v1/admin/audit?${query.toString()}`);

  return response.data;
}
