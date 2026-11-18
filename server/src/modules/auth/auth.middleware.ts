import type { Request, RequestHandler } from "express";
import type { UserRole } from "../../generated/prisma/enums.js";
import { AppError } from "../../lib/app-error.js";
import { findUserById } from "./auth.repository.js";
import { isSessionDenied } from "./token-denylist.js";
import { verifyAccessToken } from "./tokens.js";

function readBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }

  const token = header.slice("Bearer ".length).trim();

  return token.length > 0 ? token : undefined;
}

/**
 * Verifies the access token and checks the logout denylist. Role checks happen
 * separately so a route can require authentication without a role, or layer
 * `requireRole` on top.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readBearerToken(req);
  const claims = token ? await verifyAccessToken(token) : null;

  if (!claims) {
    next(AppError.unauthorized("Sign in to continue"));
    return;
  }

  if (await isSessionDenied(claims.sessionId)) {
    next(AppError.unauthorized("This session has ended. Sign in again."));
    return;
  }

  req.auth = claims;
  next();
};

export function requireRole(role: UserRole): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) {
      next(AppError.unauthorized("Sign in to continue"));
      return;
    }

    if (req.auth.role !== role) {
      next(
        new AppError(
          "FORBIDDEN",
          403,
          "Your account does not have access to this resource",
        ),
      );
      return;
    }

    next();
  };
}

/**
 * Blocks actions that require a confirmed address: creating listings, making
 * proposals, and anything payment-related. Authentication alone is not enough
 * because a typo in the address would otherwise lock the user out of recovery.
 *
 * Reads the database rather than the token: the access token was minted before
 * the user clicked the link, so its claims cannot carry the new state.
 */
export const requireVerifiedEmail: RequestHandler = async (req, _res, next) => {
  if (!req.auth) {
    next(AppError.unauthorized("Sign in to continue"));
    return;
  }

  const user = await findUserById(req.auth.userId);

  if (!user || user.status !== "ACTIVE") {
    next(AppError.unauthorized("Your account is not active"));
    return;
  }

  if (!user.emailVerifiedAt) {
    next(
      new AppError(
        "EMAIL_NOT_VERIFIED",
        403,
        "Confirm your email address to continue",
      ),
    );
    return;
  }

  next();
};
