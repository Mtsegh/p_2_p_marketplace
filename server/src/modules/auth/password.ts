import argon2 from "argon2";

/**
 * Argon2id with OWASP's baseline parameters (19 MiB, two passes, one lane).
 * Raising these values invalidates nothing: stored hashes carry their own
 * parameters, so old hashes keep verifying and new ones get the stronger cost.
 */
const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, HASH_OPTIONS);
}

export function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}

/**
 * Verification cost for a login attempt against an unknown email. Without it,
 * a missing account returns far faster than a wrong password and the response
 * time becomes a membership oracle. The hash is computed once per process.
 */
const dummyHash = hashPassword("not-a-real-password-timing-equalizer");

export async function absorbLoginTiming(password: string): Promise<void> {
  try {
    await verifyPassword(await dummyHash, password);
  } catch {
    // Timing equalization only; a failure here must not change the response.
  }
}
