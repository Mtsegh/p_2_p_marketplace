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

## Seller payout onboarding

Before a seller can accept a **paid** deal, they must complete payout
onboarding. `POST /api/v1/payments/payout/onboard` takes a two-letter country
code and asks the gateway to create a connected account; the account id is
stored privately on the user and never returned to clients. The attempt is
idempotent. `GET /api/v1/payments/payout/status` reports only `onboarded` and
`onboardedAt`. The deal service rejects accepting a sale deal (or an exchange
with a cash top-up) with `403 PAYOUT_NOT_ONBOARDED` until onboarding is done.

## Escrow hold

When a payment succeeds, the funds are held in escrow for `ESCROW_WINDOW_DAYS`
(default 7). The deal gets an `escrowExpiresAt` deadline, the transaction stays
`SUCCEEDED`, and both parties see a "Funds secured" state on the deal page. A
`HOLD` ledger entry records the net amount (amount minus platform fee).

A scheduler calls `POST /api/v1/payments/escrow/process-expired` with the
`x-cron-secret` header (from `CRON_SECRET`). It refunds every `PAYMENT_PENDING`
deal whose deadline passed: the gateway refund is issued, the transaction goes
to `REFUNDED`, the deal to `CANCELLED` with a history entry, and a `REFUND`
ledger entry is recorded. The whole operation is idempotent, so repeated runs
never double-refund.

## Fees and payouts

The platform fee is `PLATFORM_FEE_BPS` basis points (default 0 in test mode,
max 5%). It is computed when checkout starts and stored on the transaction;
the hold ledger entry records the net. Payouts to sellers happen on handoff
completion (next chunk). Disputes and split refunds come later.
