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
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code;
    this.requestId = payload.requestId;
  }
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...init.headers,
    },
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

export interface HealthReport {
  status: "ok" | "degraded";
  checks: {
    database: "up" | "down";
    redis: "up" | "down";
  };
  timestamp: string;
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
  const response = await request<{ data: HealthReport }>("/health", { signal });

  return response.data;
}
