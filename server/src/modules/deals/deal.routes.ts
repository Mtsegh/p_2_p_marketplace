import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth, requireVerifiedEmail } from "../auth/auth.middleware.js";
import * as controller from "./deal.controller.js";

export const dealRouter = Router();

const ONE_HOUR = 60 * 60;
const FIFTEEN_MINUTES = 15 * 60;

const createLimit = rateLimit({
  name: "deal-create-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const modifyLimit = rateLimit({
  name: "deal-modify-user",
  limit: 30,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const readLimit = rateLimit({
  name: "deal-read-user",
  limit: 120,
  windowSeconds: FIFTEEN_MINUTES,
  key: userKey,
});

dealRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  requireVerifiedEmail,
  createLimit,
  controller.createProposal,
);

dealRouter.get(
  "/",
  requireAuth,
  readLimit,
  controller.listDeals,
);

dealRouter.get(
  "/:dealId",
  requireAuth,
  readLimit,
  controller.getDeal,
);

dealRouter.post(
  "/:dealId/accept",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  controller.acceptDeal,
);

dealRouter.post(
  "/:dealId/reject",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  controller.rejectDeal,
);

dealRouter.post(
  "/:dealId/cancel",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  controller.cancelDeal,
);
