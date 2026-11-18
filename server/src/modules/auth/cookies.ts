import type { Request, Response } from "express";
import { env } from "../../config/env.js";

/**
 * The refresh token cookie. Scoped to the auth routes so it is not attached to
 * every API request, and `SameSite=Lax` works because the client and API share
 * a registrable domain in staging and production (see docs/staging.md).
 */
export const REFRESH_COOKIE_NAME = "marketplace_refresh";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

const REFRESH_MAX_AGE_MS = env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;

const baseOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: REFRESH_COOKIE_PATH,
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: REFRESH_MAX_AGE_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, baseOptions);
}

/** Minimal cookie reader; the API sets exactly one cookie of its own. */
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;

  if (!header) {
    return undefined;
  }

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(separator + 1).trim());
    }
  }

  return undefined;
}
