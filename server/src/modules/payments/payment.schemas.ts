import { z } from "zod";

const id = z.string().uuid("Must be a UUID");

export const createCheckoutSchema = z
  .object({ dealId: id })
  .strict();

export const dealParamsSchema = z.object({ dealId: id }).strict();

export const transactionQuerySchema = z
  .object({ dealId: id })
  .strict();

/** Webhook payload envelope. Fields are strings because gateways send JSON. */
export const webhookPayloadSchema = z
  .object({
    id: z.string().min(1).max(200),
    type: z.enum(["payment.succeeded", "payment.failed"]),
    data: z.object({
      providerPaymentId: z.string().min(1).max(200),
    }),
  })
  .strict();

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;
