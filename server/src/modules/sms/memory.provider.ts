import type { SmsMessage, SmsProvider } from "./sms.types.js";

export interface CapturedSms extends SmsMessage {
  sentAt: string;
}

/**
 * In-memory adapter used by the test suite (`SMS_PROVIDER=memory`). It keeps
 * the messages it receives so tests can read the verification code that a real
 * provider would have delivered. Each Vitest file gets its own module
 * instance, and the test helpers clear it between cases.
 */
const outbox: CapturedSms[] = [];

export const memoryProvider: SmsProvider = {
  name: "memory",

  async send(message: SmsMessage): Promise<void> {
    outbox.push({ ...message, sentAt: new Date().toISOString() });
  },
};

export function readOutbox(): readonly CapturedSms[] {
  return outbox;
}

export function clearOutbox(): void {
  outbox.length = 0;
}
