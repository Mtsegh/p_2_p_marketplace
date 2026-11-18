import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { ready } from "./modules/health/health.controller.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { apiRouter } from "./routes/index.js";

export function createApp(): express.Express {
  const app = express();

  app.disable("x-powered-by");

  // Behind the AWS load balancer both rate limiting and Secure cookies need
  // the real client IP. Locally there is no proxy.
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server) are
        // allowed; browsers only get a grant for the configured client URL.
        callback(null, !origin || origin === env.CLIENT_URL);
      },
      credentials: true,
    }),
  );
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as typeof req & { id: string }).id,
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      customSuccessMessage: (req, res) =>
        `${req.method ?? ""} ${(req as typeof req & { originalUrl?: string }).originalUrl ?? req.url ?? ""} ${res.statusCode}`.trim(),
      // Replace the default serializer, which would include full headers.
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url:
            (req as typeof req & { originalUrl?: string }).originalUrl ??
            req.url,
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(express.json({ limit: "100kb" }));

  app.get("/", (_req, res) => {
    res.json({
      data: {
        service: "marketplace-api",
        version: "v1",
        health: "/health",
        api: "/api/v1",
      },
    });
  });

  // `/health` is an alias for readiness so the roadmap's single probe works.
  app.get("/health", ready);
  app.use("/health", healthRouter);

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
