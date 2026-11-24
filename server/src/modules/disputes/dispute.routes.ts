import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import * as controller from "./dispute.controller.js";

export const disputeRouter = Router();

const ONE_HOUR = 60 * 60;

const writeLimit = rateLimit({
  name: "dispute-write-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Participants open/read disputes on their own deals.
disputeRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  writeLimit,
  controller.openDispute,
);

disputeRouter.get(
  "/deal/:dealId",
  requireAuth,
  controller.getDispute,
);

// Admin only: list and resolve.
disputeRouter.get(
  "/",
  requireAuth,
  requireRole("ADMIN"),
  controller.listDisputes,
);

disputeRouter.patch(
  "/:disputeId/resolve",
  requireTrustedOrigin,
  requireAuth,
  requireRole("ADMIN"),
  writeLimit,
  controller.resolveDispute,
);
