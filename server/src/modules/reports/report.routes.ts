import { Router } from "express";
import { rateLimit, userKey } from "../../lib/rate-limit.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import { requireAuth, requireRole } from "../auth/auth.middleware.js";
import * as controller from "./report.controller.js";

export const reportRouter = Router();

const ONE_HOUR = 60 * 60;

const writeLimit = rateLimit({
  name: "report-write-user",
  limit: 20,
  windowSeconds: ONE_HOUR,
  key: userKey,
});

reportRouter.post(
  "/",
  requireTrustedOrigin,
  requireAuth,
  writeLimit,
  controller.createReport,
);

reportRouter.get("/", requireAuth, requireRole("ADMIN"), controller.listReports);

reportRouter.patch(
  "/:reportId/resolve",
  requireTrustedOrigin,
  requireAuth,
  requireRole("ADMIN"),
  writeLimit,
  controller.resolveReport,
);
