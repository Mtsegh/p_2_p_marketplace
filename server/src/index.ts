import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";
import { closeRedis } from "./db/redis.js";
import { logger } from "./lib/logger.js";
import { closeEmailQueue } from "./modules/email/email.queue.js";
import {
  startEmailWorker,
  stopEmailWorker,
} from "./modules/email/email.worker.js";

const app = createApp();
const emailWorker = startEmailWorker();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, environment: env.NODE_ENV },
    `API listening on http://localhost:${env.PORT}`,
  );
});

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, "shutting down");

  const forceExit = setTimeout(() => {
    logger.error("graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections();
    });

    await Promise.allSettled([
      prisma.$disconnect(),
      closeRedis(),
      stopEmailWorker(emailWorker),
      closeEmailQueue(),
    ]);

    clearTimeout(forceExit);
    logger.info("shutdown complete");
    process.exit(exitCode);
  } catch (error) {
    logger.error({ err: error }, "shutdown failed");
    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "unhandled promise rejection");
});
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "uncaught exception");
  void shutdown("uncaughtException", 1);
});
