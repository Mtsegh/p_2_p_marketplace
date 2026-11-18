import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { sha256Hex } from "../../lib/hash.js";
import { emailProvider } from "./email.provider.js";
import type { EmailMessage } from "./email.types.js";

export const EMAIL_QUEUE_NAME = "email";

let queue: Queue<EmailMessage> | null = null;
let connection: Redis | null = null;

/**
 * The queue needs its own Redis connection: BullMQ blocks on commands, which is
 * incompatible with the shared client's `maxRetriesPerRequest: 1`.
 */
function getQueue(): Queue<EmailMessage> {
  if (queue) {
    return queue;
  }

  connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on("error", (error) => {
    logger.warn({ err: error }, "email queue redis error");
  });

  queue = new Queue<EmailMessage>(EMAIL_QUEUE_NAME, { connection });

  return queue;
}

/**
 * Hands a message to the worker and returns immediately. Delivery is retried by
 * the queue, so a provider outage does not drop a verification email.
 *
 * Two deliberate exceptions:
 * - Tests send inline: a background worker would make assertions race the
 *   queue, and the suite resets Redis between files.
 * - If enqueueing fails (Redis down), the message is sent inline instead. A
 *   duplicate email is harmless; a lost password reset is not.
 *
 * The job id is derived from the content, so retrying a request that already
 * enqueued the same message does not send it twice.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  if (env.NODE_ENV === "test") {
    await emailProvider.send(message);
    return;
  }

  try {
    await getQueue().add("send", message, {
      jobId: sha256Hex(`${message.to}|${message.text}`).slice(0, 32),
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 86_400, count: 1_000 },
      removeOnFail: { age: 7 * 86_400 },
    });
  } catch (error) {
    logger.warn(
      { err: error, to: message.to },
      "could not enqueue email, sending inline",
    );
    await emailProvider.send(message);
  }
}

/** Closes the producer connection during shutdown. Safe to call twice. */
export async function closeEmailQueue(): Promise<void> {
  const current = queue;
  queue = null;

  if (current) {
    await current.close();
  }

  connection?.disconnect();
  connection = null;
}
