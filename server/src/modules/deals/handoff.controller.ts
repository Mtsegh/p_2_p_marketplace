import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import * as service from "./handoff.service.js";
import { handoffCodeSchema } from "./handoff.schemas.js";
import { dealMessageParamsSchema } from "./message.schemas.js";

export const revealHandoffCode: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealMessageParamsSchema, req.params);
  const result = await service.revealHandoffCode(dealId, req.auth!.userId);

  res.json({ data: result, meta: { requestId: req.id } });
};

export const completeHandoff: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealMessageParamsSchema, req.params);
  const { code } = parseInput(handoffCodeSchema, req.body);
  const result = await service.completeHandoff(dealId, req.auth!.userId, code);

  res.json({ data: result, meta: { requestId: req.id } });
};
