import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

/** Accept client-supplied IDs only when they are safe to echo and log. */
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Attaches a request ID to every request and echoes it in the response header
 * so a user-reported error can be traced to a log line.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id =
    incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();

  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
};
