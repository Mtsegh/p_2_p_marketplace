import type { Request, RequestHandler } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { parseInput } from "../../lib/validate.js";
import { toTransactionDto } from "./payment.dto.js";
import * as service from "./payment.service.js";
import * as payoutService from "./payout.service.js";
import * as escrowService from "./escrow.service.js";
import {
  createCheckoutSchema,
  transactionQuerySchema,
  webhookPayloadSchema,
} from "./payment.schemas.js";
import { onboardSchema } from "./payout.schemas.js";
import { assertValidSignature } from "./webhook-signature.js";

/** Raw body captured by express.json's verify callback (see app.ts). */
function rawBodyOf(req: Request): string {
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;

  if (!raw) {
    throw new AppError("INVALID_SIGNATURE", 401, "Missing webhook body");
  }

  return raw.toString("utf8");
}

export const createCheckout: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(createCheckoutSchema, req.body);
  const checkout = await service.createCheckout(req.auth!.userId, dealId);

  res.status(201).json({ data: checkout, meta: { requestId: req.id } });
};

export const getTransaction: RequestHandler = async (req, res) => {
  const { dealId } = parseInput(transactionQuerySchema, req.query);
  const tx = await service.getTransactionForDeal(dealId);

  if (!tx) {
    throw AppError.notFound("Transaction not found");
  }

  res.json({ data: { transaction: toTransactionDto(tx) }, meta: { requestId: req.id } });
};

export const onboardPayout: RequestHandler = async (req, res) => {
  const input = parseInput(onboardSchema, req.body);
  const result = await payoutService.onboardSeller(req.auth!.userId, input);

  res.json({ data: result, meta: { requestId: req.id } });
};

export const getPayoutStatus: RequestHandler = async (req, res) => {
  const result = await payoutService.getPayoutStatus(req.auth!.userId);

  res.json({ data: result, meta: { requestId: req.id } });
};

/** Internal endpoint for the escrow-expiry scheduler (secret in a header). */
export const processEscrowExpiry: RequestHandler = async (req, res) => {
  if (req.get("x-cron-secret") !== env.CRON_SECRET) {
    throw new AppError("UNAUTHENTICATED", 401, "Invalid cron secret");
  }

  const result = await escrowService.processExpiredEscrows();

  res.json({ data: result });
};

export const listTransactions: RequestHandler = async (_req, res) => {
  const txs = await service.listTransactions(_req.auth!.userId);

  res.json({
    data: { transactions: txs.map(toTransactionDto) },
    meta: { requestId: _req.id },
  });
};

/**
 * Webhook source of truth. Verifies the HMAC over the raw body before parsing,
 * then hands a validated payload to the idempotent handler. No auth middleware:
 * the signature is the credential.
 */
export const webhook: RequestHandler = async (req, res) => {
  const rawBody = rawBodyOf(req);
  const signature = req.get("x-webhook-signature");

  assertValidSignature(rawBody, signature);

  const payload = parseInput(webhookPayloadSchema, JSON.parse(rawBody));
  const result = await service.handleWebhook(payload);

  res.json({ data: { received: true, ...result } });
};
