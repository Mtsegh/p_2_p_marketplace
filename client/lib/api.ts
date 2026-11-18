const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

export interface ApiErrorDetail {
  field: string;
  issue: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.details = payload.details;
    this.requestId = payload.requestId;
  }
}

/**
 * The access token lives in memory only. A page reload loses it on purpose,
 * then `refreshSession` trades the httpOnly refresh cookie for a new one. That
 * keeps the long-lived credential out of reach of scripts.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function isErrorPayload(value: unknown): value is { error: ApiErrorPayload } {
  if (typeof value !== "object" || value === null || !("error" in value)) {
    return false;
  }

  const { error } = value as { error: unknown };

  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as ApiErrorPayload).code === "string" &&
    typeof (error as ApiErrorPayload).message === "string"
  );
}

/**
 * Single entry point for API calls. Always sends cookies (the refresh token is
 * httpOnly), always opts out of caching, and attaches the access token only
 * when one is held in memory.
 */
export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  headers.set("Accept", "application/json");

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers,
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      isErrorPayload(payload)
        ? payload.error
        : {
            code: "UNEXPECTED_RESPONSE",
            message: "The API returned an unexpected response.",
          },
    );
  }

  return payload as T;
}

/** JSON convenience wrapper; used by all write endpoints. */
export function apiRequestJson<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  return apiRequest<T>(path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export interface HealthReport {
  status: "ok" | "degraded";
  checks: {
    database: "up" | "down";
    redis: "up" | "down";
  };
  timestamp: string;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
  const response = await apiRequest<{ data: HealthReport }>("/health", {
    signal,
  });

  return response.data;
}
