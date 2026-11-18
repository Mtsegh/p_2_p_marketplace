import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import { toUserDto } from "../auth/auth.dto.js";
import * as profileService from "./profile.service.js";
import { profileParamsSchema, updateProfileSchema } from "./profile.schemas.js";

export const getPublicProfile: RequestHandler = async (req, res) => {
  const { userId } = parseInput(profileParamsSchema, req.params);
  const profile = await profileService.getPublicProfile(userId);

  res.json({ data: { profile }, meta: { requestId: req.id } });
};

export const updateMyProfile: RequestHandler = async (req, res) => {
  const input = parseInput(updateProfileSchema, req.body);
  const user = await profileService.updateMyProfile(req.auth!.userId, input);

  res.json({ data: { user: toUserDto(user) }, meta: { requestId: req.id } });
};
