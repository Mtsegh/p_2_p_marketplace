import type { RequestHandler } from "express";
import { AppError } from "../../lib/app-error.js";
import { parseInput } from "../../lib/validate.js";
import { toCategoryDto, toListingDto } from "./listing.dto.js";
import * as listingRepository from "./listing.repository.js";
import * as listingService from "./listing.service.js";
import {
  categorySchema,
  createListingSchema,
  listListingsQuerySchema,
  listingParamsSchema,
  updateListingSchema,
} from "./listing.schemas.js";

export const createListing: RequestHandler = async (req, res) => {
  const input = parseInput(createListingSchema, req.body);
  const listing = await listingService.createListing(
    req.auth!.userId,
    input,
  );

  res.status(201).json({
    data: { listing: toListingDto(listing) },
    meta: { requestId: req.id },
  });
};

export const listListings: RequestHandler = async (req, res) => {
  const query = parseInput(listListingsQuerySchema, req.query);
  const result = await listingService.listActiveListings(query);

  res.json({
    data: result,
    meta: { requestId: req.id },
  });
};

export const listMyListings: RequestHandler = async (req, res) => {
  const limit = 100;
  const result = await listingService.listListingsByOwner(req.auth!.userId, {
    limit,
  });

  res.json({ data: result, meta: { requestId: req.id } });
};

export const getListing: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingParamsSchema, req.params);
  const listing = await listingRepository.findListingById(listingId);

  if (!listing) {
    throw AppError.notFound("Listing not found");
  }

  res.json({
    data: { listing: toListingDto(listing) },
    meta: { requestId: req.id },
  });
};

export const updateListing: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingParamsSchema, req.params);
  const input = parseInput(updateListingSchema, req.body);
  const listing = await listingService.updateListing(
    listingId,
    req.auth!.userId,
    input,
  );

  res.json({
    data: { listing: toListingDto(listing) },
    meta: { requestId: req.id },
  });
};

export const deleteListing: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingParamsSchema, req.params);
  await listingService.deleteListing(listingId, req.auth!.userId);

  res.status(204).end();
};

export const publishListing: RequestHandler = async (req, res) => {
  const { listingId } = parseInput(listingParamsSchema, req.params);
  const listing = await listingService.publishListing(
    listingId,
    req.auth!.userId,
  );

  res.json({
    data: { listing: toListingDto(listing) },
    meta: { requestId: req.id },
  });
};

export const listCategories: RequestHandler = async (_req, res) => {
  const categories = await listingService.listCategories();

  res.json({
    data: { categories },
    meta: { requestId: _req.id },
  });
};

export const createCategory: RequestHandler = async (req, res) => {
  const input = parseInput(categorySchema, req.body);
  const category = await listingService.createCategory(input);

  res.status(201).json({
    data: { category: toCategoryDto(category) },
    meta: { requestId: req.id },
  });
};
