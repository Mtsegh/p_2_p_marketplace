import type { RequestHandler } from "express";
import { checkReadiness } from "./health.service.js";

/** Liveness: the process is up. No dependency checks. */
export const live: RequestHandler = (_req, res) => {
  res.json({
    data: {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
};

/** Readiness: the API can serve traffic, meaning Postgres and Redis are up. */
export const ready: RequestHandler = async (_req, res) => {
  const report = await checkReadiness();

  res.status(report.status === "ok" ? 200 : 503).json({
    data: {
      ...report,
      timestamp: new Date().toISOString(),
    },
  });
};
