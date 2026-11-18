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

/**
 * Confirms an address with the token from the emailed link. The token travels
 * in the body, not the URL the API sees, so link scanners cannot consume it.
 */
export async function verifyEmailToken(token: string): Promise<AuthUser> {
  const response = await apiRequestJson<{ data: { user: AuthUser } }>(
    "/api/v1/auth/verify-email",
    "POST",
    { token },
  );

  return response.data.user;
}

export async function resendVerificationEmail(): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/verify-email/resend", "POST");
}

/**
 * Starts a reset. The API answers the same whether or not the address exists,
 * so the caller always shows the same confirmation.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/password/forgot", "POST", {
    email,
  });
}

/**
 * Completes a reset. The API revokes every session, including the one this tab
 * was using, so the in-memory access token is dropped here.
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<void> {
  try {
    await apiRequestJson<null>("/api/v1/auth/password/reset", "POST", {
      token,
      password,
    });
  } finally {
    setAccessToken(null);
  }
}
