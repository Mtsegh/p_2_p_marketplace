import { pingDatabase, pingRedis } from "./health.repository.js";

export type DependencyStatus = "up" | "down";

export interface ReadinessReport {
  status: "ok" | "degraded";
  checks: {
    database: DependencyStatus;
    redis: DependencyStatus;
  };
}

/**
 * Runs both dependency checks in parallel. Failures are reported, not thrown,
 * so the caller can always return a useful 503 body.
 */
export async function checkReadiness(): Promise<ReadinessReport> {
  const [database, cache] = await Promise.allSettled([
    pingDatabase(),
    pingRedis(),
  ]);

  const checks = {
    database: database.status === "fulfilled" ? "up" : "down",
    redis: cache.status === "fulfilled" ? "up" : "down",
  } as const;

  return {
    status:
      checks.database === "up" && checks.redis === "up" ? "ok" : "degraded",
    checks,
  };
}
