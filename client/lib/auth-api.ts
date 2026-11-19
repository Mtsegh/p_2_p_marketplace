import { ApiError, apiRequest, apiRequestJson, setAccessToken } from "./api";

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
  /** Public profile fields, flat on the user so one DTO serves every screen. */
  displayName: string;
  bio: string;
  location: string;
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

/**
 * Changes the password for the signed-in user. Every other device is signed
 * out; this session stays valid, so the in-memory token is kept.
 */
export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/password/change", "POST", input);
}

/**
 * Starts an email change. The confirmation link is sent to the new address,
 * which is what proves the user controls it.
 */
export async function requestEmailChange(input: {
  newEmail: string;
  password: string;
}): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/email/change", "POST", input);
}

export interface EmailChangeResult {
  email: string;
  userId: string;
}

/** Completes the change from the emailed link. No session is required. */
export async function confirmEmailChange(
  token: string,
): Promise<EmailChangeResult> {
  const response = await apiRequestJson<{ data: EmailChangeResult }>(
    "/api/v1/auth/email/change/confirm",
    "POST",
    { token },
  );

  return response.data;
}

/**
 * Starts phone verification. The API sends a 6-digit code to the given E.164
 * number; verifying it marks the phone as confirmed on the account.
 */
export async function sendPhoneOtp(input: { phone: string }): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/phone/send", "POST", input);
}

/** Completes phone verification with the 6-digit code. */
export async function verifyPhoneOtp(input: {
  phone: string;
  code: string;
}): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/phone/verify", "POST", input);
}

/**
 * Resends a phone verification code to the same number as the pending token.
 */
export async function resendPhoneOtp(input: { phone: string }): Promise<void> {
  await apiRequestJson<null>("/api/v1/auth/phone/resend", "POST", input);
}

/**
 * Anonymizes the account and ends every session. The API clears the refresh
 * cookie, and the access token is dropped here so the UI immediately becomes
 * signed out.
 */
export async function deleteAccount(password: string): Promise<void> {
  try {
    await apiRequestJson<null>("/api/v1/auth/account", "DELETE", { password });
  } finally {
    setAccessToken(null);
  }
}

export interface AccountExport {
  exportedAt: string;
  account: {
    id: string;
    email: string;
    role: string;
    status: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: string;
    updatedAt: string;
  };
  profile: {
    displayName: string;
    bio: string;
    location: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  sessions: {
    id: string;
    userAgent: string | null;
    ip: string | null;
    createdAt: string;
    expiresAt: string;
    revokedAt: string | null;
  }[];
}

/** Everything the account owns, ready to be saved as a JSON file. */
export async function exportAccountData(): Promise<AccountExport> {
  const response = await apiRequest<{ data: AccountExport }>(
    "/api/v1/auth/account/export",
  );

  return response.data;
}
