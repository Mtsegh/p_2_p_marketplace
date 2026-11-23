import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import * as service from "./exchange-handoff.service.js";
import { dealMessageParamsSchema } from "./message.schemas.js";

export const confirmExchangeHandoff: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealMessageParamsSchema, req.params);
  const result = await service.confirmExchangeHandoff(dealId, req.auth!.userId);

  res.json({ data: result, meta: { requestId: req.id } });
};
