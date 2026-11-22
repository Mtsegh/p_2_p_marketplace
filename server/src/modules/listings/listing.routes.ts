import { Router } from "express";
import { ipKey, rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth, requireRole, requireVerifiedEmail } from "../auth/auth.middleware.js";
import * as controller from "./listing.controller.js";
import * as imageController from "./image.controller.js";

export const listingRouter = Router();

const FIFTEEN_MINUTES = 15 * 60;
const ONE_HOUR = 60 * 60;

// Public listing reads are generous but bounded.
const publicListingsLimit = rateLimit({
  name: "public-listings-ip",
  limit: 120,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Creating a listing is a write; limit per user.
const createListingLimit = rateLimit({
  name: "create-listing-user",
  limit: 10,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Updating or deleting a listing is less frequent.
const modifyListingLimit = rateLimit({
  name: "modify-listing-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Public listing detail page reads.
const publicListingDetailLimit = rateLimit({
  name: "public-listing-detail-ip",
  limit: 60,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Category reads are public and cacheable.
const publicCategoriesLimit = rateLimit({
  name: "public-categories-ip",
  limit: 60,
  windowSeconds: FIFTEEN_MINUTES,
  key: ipKey,
});

// Image upload presign requests per user.
const presignLimit = rateLimit({
  name: "image-presign-user",
  limit: 30,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

// Image modifications per user.
const modifyImageLimit = rateLimit({
  name: "image-modify-user",
  limit: 30,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

listingRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  requireVerifiedEmail,
  createListingLimit,
  controller.createListing,
);

listingRouter.get(
  "/",
  publicListingsLimit,
  controller.listListings,
);

listingRouter.get(
  "/:listingId",
  publicListingDetailLimit,
  controller.getListing,
);

listingRouter.patch(
  "/:listingId",
  requireTrustedOrigin,
  requireAuth,
  modifyListingLimit,
  controller.updateListing,
);

listingRouter.delete(
  "/:listingId",
  requireTrustedOrigin,
  requireAuth,
  modifyListingLimit,
  controller.deleteListing,
);

listingRouter.post(
  "/:listingId/publish",
  requireTrustedOrigin,
  requireAuth,
  modifyListingLimit,
  controller.publishListing,
);

// Image upload routes require ownership of the listing.
listingRouter.post(
  "/:listingId/images/presign",
  requireTrustedOrigin,
  requireAuth,
  presignLimit,
  imageController.presignUpload,
);

listingRouter.post(
  "/:listingId/images/complete",
  requireTrustedOrigin,
  requireAuth,
  modifyImageLimit,
  imageController.completeUpload,
);

listingRouter.delete(
  "/:listingId/images/:imageId",
  requireTrustedOrigin,
  requireAuth,
  modifyImageLimit,
  imageController.deleteListingImage,
);

listingRouter.patch(
  "/:listingId/images/reorder",
  requireTrustedOrigin,
  requireAuth,
  modifyImageLimit,
  imageController.reorderListingImages,
);

// Categories are public to read, admin-only to write.
listingRouter.get(
  "/categories",
  publicCategoriesLimit,
  controller.listCategories,
);

listingRouter.post(
  "/categories",
  requireTrustedOrigin,
  requireAuth,
  requireRole("ADMIN"),
  createListingLimit,
  controller.createCategory,
);
