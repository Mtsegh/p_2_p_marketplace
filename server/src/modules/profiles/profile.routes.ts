import { Router } from "express";
import { ipKey, rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth } from "../auth/auth.middleware.js";
import * as controller from "./profile.controller.js";

export const profileRouter = Router();

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

// A public page: generous, but still bounded so scraping is not free.
const publicProfileLimit = rateLimit({
  name: "public-profile-ip",
  limit: 120,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Saving the form repeatedly is normal while editing; hammering it is not.
const updateProfileLimit = rateLimit({
  name: "profile-update-user",
  limit: 30,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

profileRouter.patch(
  "/me",
  requireTrustedOrigin,
  requireAuth,
  updateProfileLimit,
  controller.updateMyProfile,
);

profileRouter.get("/:userId", publicProfileLimit, controller.getPublicProfile);
