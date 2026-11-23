# Payments

## Money

All monetary amounts are integers in the smallest currency unit (cents), with
an explicit three-letter currency code. No floating-point values are used for
money anywhere in the API or database.

## Provider boundary

The API never handles raw card data. The buyer is redirected to the gateway's
hosted checkout; the API only calls the `PaymentProvider` interface:

- `createPayment` — create a payment and return a checkout URL (idempotent via
  an idempotency key derived from the deal id)
- `capture` — capture an authorized payment
- `refund` — refund all or part of a payment
- `payout` — send funds to a seller's connected account

The current `test` provider issues deterministic fake checkout URLs and is used
for local development and tests. A real provider can be added by implementing
the interface and switching the factory; no calling code changes.

## Webhooks are the source of truth

`POST /api/v1/payments/webhook` is unauthenticated by session. The credential is
an HMAC-SHA256 signature of the exact raw request body, sent in the
`x-webhook-signature` header and keyed by `WEBHOOK_SECRET`. The raw bytes are
captured before JSON parsing so the signature always covers what the gateway
signed.

Every event has a unique provider event id. The API records that id in
`webhook_events` and applies the state change in the same transaction. A
replayed event is detected by the unique index and has no further effect.

On `payment.succeeded`, the transaction goes to `SUCCEEDED` and the deal moves
to `PAYMENT_PENDING` with a history entry.

## Fees, escrow, and payouts

The platform fee is currently zero (`PLATFORM_FEE_BPS = 0`). Fee policy, escrow
hold windows, refund rules, and seller payouts are defined in later chunks
(escrow hold, handoff release, disputes). This document is updated as those
land; no fee or payout rule should be inferred from the current zero value.
