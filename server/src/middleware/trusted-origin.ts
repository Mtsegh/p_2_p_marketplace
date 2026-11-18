import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../lib/app-error.js";

/**
 * Browser writes must originate from the configured client. Combined with the
 * `SameSite=Lax` refresh cookie this closes cross-site form posts without a
 * CSRF token dance. Non-browser clients (curl, tests) send no Origin.
 *
 * Shared by the auth and profile routers, both of which write on behalf of the
 * signed-in user.
 */
export const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get("origin");

  if (origin && origin !== env.CLIENT_URL) {
    next(
      new AppError(
        "ORIGIN_NOT_ALLOWED",
        403,
        "Requests must come from the marketplace client",
      ),
    );
    return;
  }

  next();
};
