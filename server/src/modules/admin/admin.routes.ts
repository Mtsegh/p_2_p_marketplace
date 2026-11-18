import { Router } from "express";
import { z } from "zod";
import { parseInput } from "../../lib/validate.js";
import { toUserDto } from "../auth/auth.dto.js";
import { listUsers as findUsers } from "../auth/auth.repository.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";

export const adminRouter = Router();

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
adminRouter.get(
  "/users",
  requireAuth,
  requireRole("ADMIN"),
  async (req, res) => {
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
  },
);
