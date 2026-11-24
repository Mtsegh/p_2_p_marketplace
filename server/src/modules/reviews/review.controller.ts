import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import { toReviewDto } from "./review.dto.js";
import * as service from "./review.service.js";
import {
  createReviewSchema,
  myReviewQuerySchema,
  reviewsQuerySchema,
  trustQuerySchema,
} from "./review.schemas.js";

export const createReview: RequestHandler = async (req, res) => {
  const input = parseInput(createReviewSchema, req.body);
  const review = await service.createReview(req.auth!.userId, input);

  res.status(201).json({
    data: { review: toReviewDto(review) },
    meta: { requestId: req.id },
  });
};

export const listReviews: RequestHandler = async (req, res) => {
  const { userId, limit, cursor } = parseInput(reviewsQuerySchema, req.query);
  const result = await service.listReviewsForUser(userId, limit, cursor);

  res.json({
    data: {
      reviews: result.reviews.map(toReviewDto),
      nextCursor: result.nextCursor,
    },
    meta: { requestId: req.id },
  });
};

export const trustStats: RequestHandler = async (req, res) => {
  const { userId } = parseInput(trustQuerySchema, req.query);
  const stats = await service.trustStats(userId);

  res.json({ data: stats, meta: { requestId: req.id } });
};

export const myReview: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(myReviewQuerySchema, req.query);
  const review = await service.findMyReview(dealId, req.auth!.userId);

  res.json({ data: { review: review ? toReviewDto(review) : null }, meta: { requestId: req.id } });
};
