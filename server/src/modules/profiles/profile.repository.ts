import { prisma } from "../../db/prisma.js";
import type { UpdateProfileInput } from "./profile.schemas.js";

/**
 * Reads only what a public page needs. The email and password hash are never
 * selected, so they cannot reach a response by accident.
 */
export function findPublicProfile(userId: string) {
  return prisma.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: {
      id: true,
      createdAt: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      profile: {
        select: { displayName: true, bio: true, location: true },
      },
    },
  });
}

/**
 * Updates the caller's profile and returns the user with it attached, so the
 * client can replace its cached session user in one round trip. The nested
 * upsert covers accounts whose profile row is missing (only possible for rows
 * created before the backfill migration).
 */
export function updateProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      profile: {
        upsert: {
          create: input,
          update: input,
        },
      },
    },
    include: { profile: true },
  });
}
