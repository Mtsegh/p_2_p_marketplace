import { Router, type RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { emailKey, ipKey, rateLimit } from "../../lib/rate-limit.js";
import * as controller from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

/**
 * Browser writes must originate from the configured client. Combined with the
 * `SameSite=Lax` refresh cookie this closes cross-site form posts without a
 * CSRF token dance. Non-browser clients (curl, tests) send no Origin.
 */
const requireTrustedOrigin: RequestHandler = (req, _res, next) => {
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

// Five signups per hour per IP: registration reports EMAIL_IN_USE, so it is
// also the endpoint that could be used to probe for accounts.
const registerLimit = rateLimit({
  name: "register-ip",
  limit: 5,
  windowSeconds: ONE_HOUR,
  key: ipKey,
});

// Two login buckets: one per address (stops guessing against one account) and
// one per IP (stops spraying many addresses from one host).
const loginIpLimit = rateLimit({
  name: "login-ip",
  limit: 30,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});
const loginEmailLimit = rateLimit({
  name: "login-email",
  limit: 10,
  windowSeconds: FIFTEEN_MINUTES,
  key: emailKey,
});

const refreshLimit = rateLimit({
  name: "refresh-ip",
  limit: 60,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

authRouter.post(
  "/register",
  requireTrustedOrigin,
  registerLimit,
  controller.register,
);
authRouter.post(
  "/login",
  requireTrustedOrigin,
  loginIpLimit,
  loginEmailLimit,
  controller.login,
);
authRouter.post(
  "/refresh",
  requireTrustedOrigin,
  refreshLimit,
  controller.refresh,
);
authRouter.post("/logout", requireTrustedOrigin, controller.logout);

authRouter.get("/me", requireAuth, controller.me);
authRouter.get("/sessions", requireAuth, controller.sessions);
authRouter.delete(
  "/sessions/:sessionId",
  requireAuth,
  controller.revokeSession,
);
