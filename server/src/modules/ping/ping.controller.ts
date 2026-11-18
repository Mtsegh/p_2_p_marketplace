import type { RequestHandler } from "express";
import { z } from "zod";
import { parseInput } from "../../lib/validate.js";

const pingQuerySchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
});

/**
 * Versioned API probe. Exists so the routing, validation, and error envelope
 * can be exercised end to end before real business endpoints exist.
 */
export const ping: RequestHandler = (req, res) => {
  const { name } = parseInput(pingQuerySchema, req.query);

  res.json({
    data: {
      message: name ? `pong, ${name}` : "pong",
    },
    meta: {
      requestId: req.id,
    },
  });
};
