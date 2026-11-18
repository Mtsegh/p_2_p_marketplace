import type { Profile, User } from "../../generated/prisma/client.js";

/**
 * A user with its public profile row. The profile is optional in the type
 * because a few callers (the admin list before this chunk) select users without
 * the relation; the DTO falls back to empty strings rather than crashing.
 */
export type UserWithProfile = User & { profile?: Profile | null };

export interface UserDto {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  displayName: string;
  bio: string;
  location: string;
}

/**
 * The only shape user records leave the API in. Never add password hashes or
 * token material here; new fields are opt-in on purpose.
 */
export function toUserDto(user: UserWithProfile): UserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
    createdAt: user.createdAt.toISOString(),
    displayName: user.profile?.displayName ?? "",
    bio: user.profile?.bio ?? "",
    location: user.profile?.location ?? "",
  };
}

export interface SessionDto {
  id: string;
  userAgent: string | null;
  ip: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}
