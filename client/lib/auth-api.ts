import { ApiError, apiRequestJson, setAccessToken } from "./api";

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
}

interface AuthPayload {
  user: AuthUser;
  accessToken: string;
  expiresIn: number;
}

export interface Credentials {
  email: string;
  password: string;
}

function adopt(payload: AuthPayload): AuthUser {
  setAccessToken(payload.accessToken);
  return payload.user;
}

export async function registerAccount(
  credentials: Credentials,
): Promise<AuthUser> {
  const response = await apiRequestJson<{ data: AuthPayload }>(
    "/api/v1/auth/register",
    "POST",
    credentials,
  );

  return adopt(response.data);
}

export async function loginAccount(
  credentials: Credentials,
): Promise<AuthUser> {
  const response = await apiRequestJson<{ data: AuthPayload }>(
    "/api/v1/auth/login",
    "POST",
    credentials,
  );

  return adopt(response.data);
}

async function performRefresh(): Promise<AuthUser | null> {
  try {
    const response = await apiRequestJson<{ data: AuthPayload }>(
      "/api/v1/auth/refresh",
      "POST",
    );

    return adopt(response.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      setAccessToken(null);
      return null;
    }

    throw error;
  }
}

/**
 * Restores the session on page load. Concurrent callers (React strict mode,
 * two components asking at once) share one request so a single refresh token
 * is never spent twice.
 */
let refreshInFlight: Promise<AuthUser | null> | null = null;

export function refreshSession(): Promise<AuthUser | null> {
  refreshInFlight ??= performRefresh().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/** Always clears the in-memory token, even when the API call fails. */
export async function logoutAccount(): Promise<void> {
  try {
    await apiRequestJson<null>("/api/v1/auth/logout", "POST");
  } finally {
    setAccessToken(null);
  }
}
