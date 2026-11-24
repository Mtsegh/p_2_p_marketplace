import { Router } from "express";
import { ipKey, rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./review.controller.js";

export const reviewRouter = Router();

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

const writeLimit = rateLimit({
  name: "review-write-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Public trust-signal reads are bounded per IP to stop mass profile scraping.
const publicReadLimit = rateLimit({
  name: "review-public-read-ip",
  limit: 120,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

reviewRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  writeLimit,
  controller.createReview,
);

// Public reads for trust signals.
reviewRouter.get("/", publicReadLimit, controller.listReviews);
reviewRouter.get("/trust", publicReadLimit, controller.trustStats);

reviewRouter.get("/mine", requireAuth, controller.myReview);
