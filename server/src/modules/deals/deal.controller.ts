import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import { toDealDto } from "./deal.dto.js";
import * as service from "./deal.service.js";
import {
  createProposalSchema,
  dealParamsSchema,
  listDealsQuerySchema,
} from "./deal.schemas.js";

export const createProposal: RequestHandler = async (req, res) => {
  const input = parseInput(createProposalSchema, req.body);
  const deal = await service.createProposal(req.auth!.userId, input);

  res.status(201).json({
    data: { deal: toDealDto(deal) },
    meta: { requestId: req.id },
  });
};

export const acceptDeal: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealParamsSchema, req.params);
  const deal = await service.acceptDeal(dealId, req.auth!.userId);

  res.json({
    data: { deal: toDealDto(deal) },
    meta: { requestId: req.id },
  });
};

export const rejectDeal: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealParamsSchema, req.params);
  const deal = await service.endDeal(dealId, req.auth!.userId, "REJECTED");

  res.json({
    data: { deal: toDealDto(deal) },
    meta: { requestId: req.id },
  });
};

export const cancelDeal: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealParamsSchema, req.params);
  const deal = await service.endDeal(dealId, req.auth!.userId, "CANCELLED");

  res.json({
    data: { deal: toDealDto(deal) },
    meta: { requestId: req.id },
  });
};

export const getDeal: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealParamsSchema, req.params);
  const deal = await service.getDeal(dealId, req.auth!.userId);

  res.json({
    data: { deal: toDealDto(deal) },
    meta: { requestId: req.id },
  });
};

export const listDeals: RequestHandler = async (req, res) => {
  const query = parseInput(listDealsQuerySchema, req.query);
  const result = await service.listDeals(req.auth!.userId, query);

  res.json({
    data: {
      deals: result.deals.map(toDealDto),
      nextCursor: result.nextCursor,
    },
    meta: { requestId: req.id },
  });
};
