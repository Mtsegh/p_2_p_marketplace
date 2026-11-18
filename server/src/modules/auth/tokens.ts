import { randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../../config/env.js";
import type { UserRole } from "../../generated/prisma/enums.js";
import { sha256Hex } from "../../lib/hash.js";

const ACCESS_TOKEN_ISSUER = "marketplace-api";
const ACCESS_TOKEN_AUDIENCE = "marketplace-client";

const accessTokenSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
  role: UserRole;
}

export function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ sid: claims.sessionId, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.userId)
    .setIssuer(ACCESS_TOKEN_ISSUER)
    .setAudience(ACCESS_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(accessTokenSecret);
}

/**
 * Returns the claims for a valid token. Any problem (bad signature, wrong
 * issuer/audience, expiry, malformed payload) is a single invalid-token case;
 * callers turn that into a 401 without leaking which check failed.
 */
export async function verifyAccessToken(
  token: string,
): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessTokenSecret, {
      issuer: ACCESS_TOKEN_ISSUER,
      audience: ACCESS_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    });

    const { sub, sid, role } = payload;

    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      (role !== "USER" && role !== "ADMIN")
    ) {
      return null;
    }

    return { userId: sub, sessionId: sid, role };
  } catch {
    return null;
  }
}

/**
 * Refresh tokens are opaque random strings. Only a SHA-256 hash is stored, so a
 * leaked database cannot be replayed as a session.
 */
export function hashRefreshToken(token: string): string {
  return sha256Hex(token);
}

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString("base64url");

  return { token, tokenHash: hashRefreshToken(token) };
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
}

/** Lifetime of a newly issued access token, in seconds, for client hints. */
export const accessTokenTtlSeconds = env.ACCESS_TOKEN_TTL_SECONDS;
