# Security review and abuse protection

This document records the hardening pass for the P2P marketplace. It is a
living checklist: each item lists the control, the evidence, and any open
ticket. "Fixed" means the control exists in code and has a regression test.

## 1. OWASP Top 10 (2021) pass

| # | Category | Status | Control / evidence |
| - | -------- | ------ | ------------------ |
| A01 | Broken access control | Fixed | `requireAuth` + `requireRole("ADMIN")` on every admin route; object-level checks in all services (see §3). Suspended users' sessions are revoked. |
| A02 | Cryptographic failures | Fixed | argon2 password hashing; 256-bit random action tokens stored as SHA-256 hashes; HMAC-SHA256 webhook signatures compared with `timingSafeEqual`; handoff codes stored only as hashes. |
| A03 | Injection | Fixed | All DB access through Prisma (parameterized); the one raw-SQL query (listing search) uses `Prisma.sql`/`Prisma.join` with bound values only. Zod validates all external input. |
| A04 | Insecure design | Fixed | Explicit deal state machine; escrow hold with auto-refund; dual confirmation for swaps; dispute freeze. See `docs/payments.md` and the API docs. |
| A05 | Security misconfiguration | Fixed | Helmet headers; strict CORS allowlist; `x-powered-by` disabled; `trust proxy` only in production; errors return a uniform shape without stack traces. |
| A06 | Vulnerable components | Open (ticket SEC-1) | Dependabot configured for npm (server, client) and GitHub Actions. `npm audit` could not run locally: the sandbox has no npm registry access (`socket hang up`). Must be run in CI/a networked environment before launch. |
| A07 | Identification & auth failures | Fixed | Short-lived access tokens + rotating refresh in `httpOnly`, `Secure`, `SameSite=Lax` cookies; denylist on logout/suspend; per-IP and per-email login limits; identical responses for unknown email / wrong password / deleted account. |
| A08 | Software & data integrity | Fixed | Webhooks are the source of truth, signature-verified over the raw body, with unique event IDs for idempotency. Unsigned events cannot change payment or deal state. |
| A09 | Logging & monitoring failures | Fixed | Structured pino logs with request IDs; warnings for rate-limit/Redis failures; errors for email delivery failures. Tokens, passwords, and payment secrets are never logged. |
| A10 | SSRF | Fixed | Outbound URLs are not taken from user input except the gateway's fixed hosted-checkout base; image uploads use presigned PUT URLs to a configured bucket only. |

## 2. Rate-limit matrix

All counters are Redis fixed windows with atomic INCR/EXPIRE. The limiter fails
open during a Redis outage (logged) so authentication stays usable.

| Endpoint group | Key | Limit / window |
| -------------- | --- | -------------- |
| Register | IP | 5 / 1h |
| Login | IP + hashed email | 30 / 15m, 10 / 15m |
| Refresh | IP | 60 / 15m |
| Email verify / resend | IP / user | 30 / 15m, 3 / 1h |
| Password reset request / confirm | email + IP / IP | 5 / 1h, 10 / 1h, 10 / 15m |
| Email / password / account change | user | 3-5 / 1h |
| Phone OTP send / verify | user | 3 / 1h, 10 / 15m |
| Listing search (`GET /listings`) | IP | 120 / 15m |
| Listing detail / categories | IP | 60 / 15m |
| Listing create / modify | user | 10 / 1h, 20 / 1h |
| Image presign / modify | user | 30 / 1h |
| Proposal create / modify | user | 20 / 1h, 30 / 1h |
| Deal thread reads / writes | user | 120 / 15m, 30 / 1h |
| Checkout / payout onboarding | user | 20 / 1h |
| Payment webhook / escrow processor | IP | 300 / 1h |
| Disputes / reports / reviews writes | user | 20 / 1h |
| Review public reads | IP | 120 / 15m |
| Profile reads | IP | 60 / 15m |

**Fixed in this pass:** public review reads (`GET /reviews`, `/reviews/trust`)
previously had no limiter; they now use an IP bucket. Their query parameters
(`userId`, `dealId`) are now zod-validated as UUIDs, so malformed input returns
`422` instead of a Prisma error/500.

## 3. Object-level authorization audit

Every service that accepts a caller id scopes its query to that caller. The
patterns below were verified in code:

- Listings: `updateListing`, `deleteListing`, `publishListing` and all image
  operations check `listing.ownerId === userId` before writing.
- Deals: `getDeal`, `acceptDeal`, `endDeal`, messages, handoff, and disputes
  check that the caller is the buyer or seller, then apply the actor rule for
  the specific transition (`actorFor`).
- Sessions: `revokeOwnedSession` includes `userId` in the `WHERE` clause, so a
  guessed foreign session id returns `404`, not a 403 existence hint.
- Profile: `updateMyProfile` always writes using `req.auth.userId`; the route
  never accepts a target user id.
- Reviews: the subject is derived from the deal, never from the request;
  a caller can only review a completed deal they participated in.
- Reports: self-reports and reports on one's own listing return `422`.
- Admin: all routes require `ADMIN` server-side; the audit log records every
  mutation with actor and before/after values.

## 4. Abuse-test inventory

| Scenario | Test |
| -------- | ---- |
| Brute-force login (per IP / per email) | `test/auth.test.ts` |
| Scripted registration / enumeration | `test/auth.test.ts` |
| Search flooding (429 + `Retry-After`) | `test/abuse.test.ts` |
| Proposal flooding (429) | `test/abuse.test.ts` |
| Webhook with missing / invalid signature | `test/payments.test.ts` |
| Webhook body tampered after signing | `test/abuse.test.ts` |
| Webhook replay (duplicate event id is a no-op) | `test/payments.test.ts` |
| Malformed webhook payload | `test/payments.test.ts` |
| Handoff code wrong attempt counting and lockout | `test/handoff.test.ts`, `test/abuse.test.ts` |
| Handoff code expired | `test/handoff.test.ts` |
| Buyer cannot reveal seller's role / seller cannot reveal code | `test/handoff.test.ts` |
| Stranger reading a deal / thread / dispute | `test/deals.test.ts`, `test/disputes.test.ts` |
| Escrow expiry refund is idempotent | `test/payments.test.ts` |
| Double-accept / competing proposals rejected | `test/deals.test.ts` |

## 5. Secrets and data exposure

- Secrets live only in environment variables; `server/.env.example` contains
  placeholders. No live keys or secrets are committed.
- Refresh cookies are `httpOnly`, `Secure` (production), `SameSite=Lax`.
- Error responses use `{ error: { code, message, details?, requestId } }` and
  never include stack traces.
- Public user DTOs omit the password hash; payout account ids are never
  serialized to clients.
- Emails never contain full tokens or payment details.

## 6. Tickets

- **SEC-1 (Open):** run `npm audit --audit-level=high` for both `server/` and
  `client/` in an environment with npm registry access and upgrade any
  high/critical advisories. Locally the audit endpoint is unreachable
  (`socket hang up`), so this could not be completed in this pass. Dependabot
  will open update PRs weekly in the meantime.
