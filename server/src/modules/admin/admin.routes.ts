import { Router } from "express";
import { z } from "zod";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { parseInput } from "../../lib/validate.js";
import { toUserDto } from "../auth/auth.dto.js";
import { listUsers as findUsers } from "../auth/auth.repository.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import * as service from "./admin.service.js";
import {
  auditQuerySchema,
  listingsQuerySchema,
  moderateListingSchema,
  settingsSchema,
  userParamsSchema,
  userStatusSchema,
  listingParamsSchema,
} from "./admin.schemas.js";

export const adminRouter = Router();

// All admin routes require the ADMIN role, checked server-side.
const adminGuard = [requireAuth, requireRole("ADMIN")] as const;

const adminWriteLimit = rateLimit({
  name: "admin-write-user",
  limit: 60,
  windowSeconds: 3600,
  key: userKey,
});

const listUsersQuery = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid("Cursor must be a user id").optional(),
  })
  .strict();

/**
 * User directory for administrators. Cursor pagination keeps the query stable
 * while accounts are created; the cursor is the last row's id.
 */
adminRouter.get("/users", ...adminGuard, async (req, res) => {
  const { q, limit, cursor } = parseInput(listUsersQuery, req.query);
  const rows = await findUsers({ q, limit, cursor });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  res.json({
    data: { users: page.map(toUserDto) },
    meta: {
      requestId: req.id,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    },
  });
});

// Suspend or reactivate a user.
adminRouter.patch(
  "/users/:userId",
  ...adminGuard,
  adminWriteLimit,
  async (req, res) => {
    const { userId } = parseInput(userParamsSchema, req.params);
    const { status } = parseInput(userStatusSchema, req.body);
    const user = await service.setUserStatus(req.auth!.userId, userId, status);

    res.json({ data: { user }, meta: { requestId: req.id } });
  },
);

// Listings moderation overview.
adminRouter.get("/listings", ...adminGuard, async (req, res) => {
  const query = parseInput(listingsQuerySchema, req.query);
  const result = await service.listAllListings(query);

  res.json({ data: result, meta: { requestId: req.id } });
});

// Remove or restore a listing.
adminRouter.patch(
  "/listings/:listingId",
  ...adminGuard,
  adminWriteLimit,
  async (req, res) => {
    const { listingId } = parseInput(listingParamsSchema, req.params);
    const { action, reason } = parseInput(moderateListingSchema, req.body);
    const listing = await service.moderateListing(
      req.auth!.userId,
      listingId,
      action,
      reason,
    );

    res.json({ data: { listing }, meta: { requestId: req.id } });
  },
);

// Editable platform settings.
adminRouter.get("/settings", ...adminGuard, async (req, res) => {
  const settings = await service.getSettings();

  res.json({ data: { settings }, meta: { requestId: req.id } });
});

adminRouter.patch(
  "/settings",
  ...adminGuard,
  adminWriteLimit,
  async (req, res) => {
    const input = parseInput(settingsSchema, req.body);
    const settings = await service.updateSettings(req.auth!.userId, input);

    res.json({ data: { settings }, meta: { requestId: req.id } });
  },
);

// Append-only audit log of admin actions.
adminRouter.get("/audit", ...adminGuard, async (req, res) => {
  const query = parseInput(auditQuerySchema, req.query);
  const result = await service.listAudit(query);

  res.json({ data: result, meta: { requestId: req.id } });
});
