import type { RequestHandler } from "express";
import { AppError } from "../../lib/app-error.js";
import { parseInput } from "../../lib/validate.js";
import { toDisputeDto } from "./dispute.dto.js";
import * as service from "./dispute.service.js";
import {
  disputeIdParamsSchema,
  disputeParamsSchema,
  openDisputeSchema,
  resolveDisputeSchema,
} from "./dispute.schemas.js";

export const openDispute: RequestHandler = async (req, res) => {
  const input = parseInput(openDisputeSchema, req.body);
  const dispute = await service.openDispute(
    input.dealId,
    req.auth!.userId,
    input.reason,
  );

  res.status(201).json({
    data: { dispute: toDisputeDto(dispute) },
    meta: { requestId: req.id },
  });
};

export const getDispute: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(disputeParamsSchema, req.params);
  const dispute = await service.getDisputeForDeal(dealId);

  if (!dispute) {
    throw AppError.notFound("Dispute not found");
  }

  res.json({ data: { dispute: toDisputeDto(dispute) }, meta: { requestId: req.id } });
};

export const resolveDispute: RequestHandler = async (req, res) => {
  const { disputeId } = parseInput(disputeIdParamsSchema, req.params);
  const input = parseInput(resolveDisputeSchema, req.body);
  const dispute = await service.resolveDispute(
    disputeId,
    req.auth!.userId,
    input,
  );

  res.json({ data: { dispute: toDisputeDto(dispute) }, meta: { requestId: req.id } });
};

export const listDisputes: RequestHandler = async (req, res) => {
  const status = req.query.status === "OPEN" || req.query.status === "RESOLVED"
    ? req.query.status
    : undefined;
  const disputes = await service.listDisputes(status);

  res.json({ data: { disputes: disputes.map(toDisputeDto) }, meta: { requestId: req.id } });
};
