import { createHash } from "node:crypto";

/**
 * Lowercase hex SHA-256. Used for anything stored that must never be replayed
 * if the database leaks: refresh tokens, email verification tokens, password
 * reset tokens.
 */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
