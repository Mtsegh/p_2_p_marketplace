import { AppError } from "../../lib/app-error.js";
import { toPublicProfileDto, type PublicProfileDto } from "./profile.dto.js";
import * as repository from "./profile.repository.js";
import type { UpdateProfileInput } from "./profile.schemas.js";

/**
 * A stranger's view of an account. Missing, suspended, and deleted accounts all
 * answer the same 404: the outside world cannot tell a banned user from a user
 * who never existed.
 */
export async function getPublicProfile(
  userId: string,
): Promise<PublicProfileDto> {
  const user = await repository.findPublicProfile(userId);

  if (!user) {
    throw AppError.notFound("Profile not found");
  }

  return toPublicProfileDto(user);
}

export function updateMyProfile(userId: string, input: UpdateProfileInput) {
  return repository.updateProfile(userId, input);
}
