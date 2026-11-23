import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./payment.controller.js";

export const paymentRouter = Router();

const ONE_HOUR = 60 * 60;

const createLimit = rateLimit({
  name: "checkout-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

const webhookLimit = rateLimit({
  name: "payment-webhook-ip",
  limit: 300,
  windowSeconds: ONE_HOUR,
  key: (req) => req.ip ?? "unknown",
});

paymentRouter.post(
  "/checkout",
  requireTrustedOrigin,
  requireAuth,
  createLimit,
  controller.createCheckout,
);

paymentRouter.get(
  "/transactions",
  requireAuth,
  controller.listTransactions,
);

paymentRouter.get(
  "/transaction",
  requireAuth,
  controller.getTransaction,
);

paymentRouter.post("/webhook", webhookLimit, controller.webhook);

paymentRouter.post(
  "/payout/onboard",
  requireTrustedOrigin,
  requireAuth,
  createLimit,
  controller.onboardPayout,
);

paymentRouter.get(
  "/payout/status",
  requireAuth,
  controller.getPayoutStatus,
);
