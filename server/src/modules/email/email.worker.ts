import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { emailProvider } from "./email.provider.js";
import type { EmailMessage } from "./email.types.js";
import { EMAIL_QUEUE_NAME } from "./email.queue.js";

/**
 * In-process worker. It is started by `src/index.ts` only, so importing the app
 * in tests never opens a second Redis connection or consumes jobs.
 *
 * Running the worker next to the API is fine at this size. When traffic grows,
 * the same function moves to a dedicated process without changing the queue or
 * the provider.
 */
export function startEmailWorker(): Worker<EmailMessage> {
  const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

  const worker = new Worker<EmailMessage>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      await emailProvider.send(job.data);
    },
    { connection, concurrency: 2 },
  );

  worker.on("failed", (job, error) => {
    logger.error(
      {
        err: error,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        provider: emailProvider.name,
      },
      "email delivery failed",
    );
  });

  worker.on("error", (error) => {
    logger.warn({ err: error }, "email worker redis error");
  });

  return worker;
}

export async function stopEmailWorker(
  worker: Worker<EmailMessage>,
): Promise<void> {
  await worker.close();
}
