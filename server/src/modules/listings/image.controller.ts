import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import * as imageService from "./image.service.js";
import {
  completeUploadSchema,
  listingAndImageIdParamsSchema,
  listingIdParamsSchema,
  presignUploadSchema,
  reorderImagesSchema,
} from "./image.schemas.js";

export const presignUpload: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingIdParamsSchema, req.params);
  const input = parseInput(presignUploadSchema, {
    ...req.body,
    listingId,
  });

  const upload = await imageService.presignUpload(req.auth!.userId, input);

  res.json({
    data: { upload },
    meta: { requestId: req.id },
  });
};

export const completeUpload: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingIdParamsSchema, req.params);
  const input = parseInput(completeUploadSchema, req.body);

  const image = await imageService.completeUpload(
    req.auth!.userId,
    listingId,
    input,
  );

  res.json({
    data: { image },
    meta: { requestId: req.id },
  });
};

export const deleteListingImage: RequestHandler = async (req, res) => {
  const { imageId } = parseInput(
    listingAndImageIdParamsSchema,
    req.params,
  );

  await imageService.deleteListingImage(req.auth!.userId, imageId);

  res.status(204).end();
};

export const reorderListingImages: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingIdParamsSchema, req.params);
  const input = parseInput(reorderImagesSchema, req.body);

  await imageService.reorderListingImages(req.auth!.userId, listingId, input);

  res.status(204).end();
};
