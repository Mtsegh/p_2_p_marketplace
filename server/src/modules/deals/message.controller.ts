import type { RequestHandler } from "express";
import { parseInput } from "../../lib/validate.js";
import * as service from "./message.service.js";
import {
  createMessageSchema,
  dealMessageParamsSchema,
  listMessagesQuerySchema,
} from "./message.schemas.js";

export const postMessage: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealMessageParamsSchema, req.params);
  const input = parseInput(createMessageSchema, req.body);
  const message = await service.postMessage(dealId, req.auth!.userId, input);

  res.status(201).json({
    data: { message: { ...message, createdAt: message.createdAt.toISOString() } },
    meta: { requestId: req.id },
  });
};

export const listMessages: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(dealMessageParamsSchema, req.params);
  const query = parseInput(listMessagesQuerySchema, req.query);
  const result = await service.listMessages(dealId, req.auth!.userId, query);

  res.json({ data: result, meta: { requestId: req.id } });
};
