import type { EmailMessage, EmailProvider } from "./email.types.js";

export interface CapturedEmail extends EmailMessage {
  sentAt: string;
}

/**
 * In-memory adapter used by the test suite (`EMAIL_PROVIDER=memory`). It keeps
 * the messages it receives so tests can follow the link that a real provider
 * would have delivered. Each Vitest file gets its own module instance, and the
 * test helpers clear it between cases.
 */
const outbox: CapturedEmail[] = [];

export const memoryProvider: EmailProvider = {
  name: "memory",

  async send(message: EmailMessage): Promise<void> {
    outbox.push({ ...message, sentAt: new Date().toISOString() });
  },
};

export function readOutbox(): readonly CapturedEmail[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}
