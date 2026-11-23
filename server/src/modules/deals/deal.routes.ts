import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth, requireVerifiedEmail } from "../auth/auth.middleware.js";
import * as controller from "./deal.controller.js";
import * as messageController from "./message.controller.js";
import * as handoffController from "./handoff.controller.js";
import * as exchangeHandoffController from "./exchange-handoff.controller.js";

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

dealRouter.post(
  "/exchange",
  requireTrustedOrigin,
  requireAuth,
  requireVerifiedEmail,
  createLimit,
  controller.createExchangeProposal,
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

// Deal thread: only participants can read/write (checked in the service).
dealRouter.get(
  "/:dealId/messages",
  requireAuth,
  readLimit,
  messageController.listMessages,
);

dealRouter.post(
  "/:dealId/messages",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  messageController.postMessage,
);

// One-time handoff code: buyer reveals, seller submits to complete the deal.
dealRouter.post(
  "/:dealId/handoff/reveal",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  handoffController.revealHandoffCode,
);

dealRouter.post(
  "/:dealId/handoff/complete",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  handoffController.completeHandoff,
);

// Exchange deals require both parties to confirm the handoff.
dealRouter.post(
  "/:dealId/handoff/confirm",
  requireTrustedOrigin,
  requireAuth,
  modifyLimit,
  exchangeHandoffController.confirmExchangeHandoff,
);
