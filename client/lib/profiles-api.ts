import { apiRequest, apiRequestJson } from "./api";
import type { AuthUser } from "./auth-api";

/**
 * What a stranger may see about another member. The API never includes an
 * email address here, so there is nothing to hide on the client either.
 */
export interface PublicProfile {
  id: string;
  displayName: string;
  bio: string;
  location: string;
  memberSince: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

export interface UpdateProfileInput {
  displayName?: string;
  bio?: string;
  location?: string;
}

export async function fetchPublicProfile(
  userId: string,
): Promise<PublicProfile> {
  const response = await apiRequest<{ data: { profile: PublicProfile } }>(
    `/api/v1/profiles/${encodeURIComponent(userId)}`,
  );

  return response.data.profile;
}

/**
 * Saves the caller's own profile. The API answers with the whole user so the
 * session cache can be replaced in one round trip instead of refetching it.
 */
export async function updateProfile(
  input: UpdateProfileInput,
): Promise<AuthUser> {
  const response = await apiRequestJson<{ data: { user: AuthUser } }>(
    "/api/v1/profiles/me",
    "PATCH",
    input,
  );

  return response.data.user;
}
