export interface PublicProfileDto {
  id: string;
  displayName: string;
  bio: string;
  location: string;
  memberSince: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

/**
 * What a stranger may see. Deliberately excludes the email address, role,
 * status, and every credential field: this object is built field by field from
 * a narrow select, so a future column cannot leak by being added to the model.
 */
export function toPublicProfileDto(user: {
  id: string;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  profile: { displayName: string; bio: string; location: string } | null;
}): PublicProfileDto {
  return {
    id: user.id,
    displayName: user.profile?.displayName ?? "",
    bio: user.profile?.bio ?? "",
    location: user.profile?.location ?? "",
    memberSince: user.createdAt.toISOString(),
    emailVerified: user.emailVerifiedAt !== null,
    phoneVerified: user.phoneVerifiedAt !== null,
  };
}
