import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./review.controller.js";

export const reviewRouter = Router();

const ONE_HOUR = 60 * 60;

const writeLimit = rateLimit({
  name: "review-write-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

reviewRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  writeLimit,
  controller.createReview,
);

// Public reads for trust signals.
reviewRouter.get("/", controller.listReviews);
reviewRouter.get("/trust", controller.trustStats);

reviewRouter.get("/mine", requireAuth, controller.myReview);
