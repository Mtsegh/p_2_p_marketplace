# AGENTS.md

Guidance for AI coding agents (and human contributors) working on this repository.

## Project Overview

A peer-to-peer (P2P) marketplace where users list items and either **sell** them for money or **exchange** (swap) them with other users. The platform handles registration and verification, listings, search and filtering, proposal-based deals, secure payments, email notifications, and an admin dashboard.

### Core Features

1. **Accounts**: registration, login, profiles, email verification, optional identity verification.
2. **Listings**: create/edit/delete, image upload, browse, search, filter, sort, pagination.
3. **Deals**: sale and exchange workflows with proposal, acceptance, rejection, cancellation, and completion.
4. **Payments**: secure gateway integration, transaction records, refunds, payouts.
5. **Notifications**: automated transactional emails for key events.
6. **Admin dashboard**: manage users, listings, reports, and transactions.
7. **Quality**: testing, deployment, security hardening, performance optimization.

## Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React.js with Next.js (App Router, TypeScript) |
| Backend | Node.js with Express.js (TypeScript), REST API |
| Database | **PostgreSQL** (single primary database, see Database Decision) |
| ORM / migrations | Prisma (or Drizzle); all schema changes go through migrations |
| Cache / queues | Redis (rate limiting, sessions/token denylist, background jobs via BullMQ) |
| Payments | Stripe (Stripe Connect for marketplace payouts) or Razorpay, behind a provider interface |
| Email | Transactional provider (Resend, SendGrid, or SES) via a queue |
| File storage | S3-compatible object storage (AWS S3) for listing images |
| Deployment | Vercel for the Next.js app; AWS (ECS/Fargate or Elastic Beanstalk, RDS PostgreSQL, S3, SES) for the API |

## Database Decision

Use **PostgreSQL only**. Do not introduce MongoDB unless a documented need arises.

Reasons:
- The domain is highly relational: users, listings, proposals, transactions, reviews, and reports reference each other.
- Payments and deal state changes need ACID transactions (for example, accepting a proposal must mark the listing reserved and create the transaction atomically).
- Constraints, foreign keys, and unique indexes enforce marketplace rules at the database level.
- Search and filtering are covered by indexes, `tsvector` full-text search, and `pg_trgm`. Flexible listing attributes can use `JSONB` columns.
- One database means simpler deployment, backups, and testing.

Revisit only if full-text search outgrows Postgres (then add Elasticsearch/Meilisearch/OpenSearch as a *search index*, with Postgres remaining the source of truth).

## Repository Structure (target)

```
/
├── client/               # Next.js frontend
├── server/               # Express backend
├── prisma/               # Schema, migrations, seed scripts
├── docs/                 # Architecture notes, API contract, ADRs
├── .github/workflows/    # CI/CD
└── AGENTS.md
```

`client/` and `server/` live in the same repo but are built, run, tested, and deployed **independently**. Each has its own `package.json`, dependencies, linting, and TypeScript config. Do not import code across them, and do not mix frontend and backend code.

## Commands

`client/` and `server/` are separate projects. Run commands from inside the relevant folder (`cd client` or `cd server`). Update these if scripts change, and always check that folder's `package.json` before assuming.

```bash
npm install            # install dependencies
npm run dev            # start the dev server (client or server, depending on the folder)
npm run build          # production build
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run format         # prettier --write .
npm run test           # unit and integration tests (added in a later chunk)
npm run test:e2e       # Playwright end-to-end tests (added in a later chunk)
npx prisma migrate dev --schema ../prisma/schema.prisma # run from server/; create/apply a migration locally (chunk 2)
npx prisma generate --schema ../prisma/schema.prisma    # run from server/; regenerate the Prisma client (chunk 2)
npm run db:seed        # seed dev data (chunk 2)
```

Local infrastructure (PostgreSQL, Redis) runs through Docker Compose from the repository root: `docker compose up -d`.

Before declaring any task done, run: `lint`, `typecheck`, and `test`.

## Coding Conventions

- **TypeScript everywhere**, with `strict` mode on. No `any` without a comment explaining why.
- Validate all external input (request bodies, query params, env vars, webhooks) with **zod** on the server. The client keeps its own form validation and types. Because there is no shared package, document the API contract in `docs/` (OpenAPI or a markdown spec) and update it whenever an endpoint changes.
- Backend layering: `routes` -> `controllers` -> `services` -> `repositories/db`. Controllers stay thin; business logic lives in services.
- Use a consistent error format: `{ error: { code, message, details? } }` with correct HTTP status codes.
- REST conventions: plural nouns, versioned under `/api/v1`, cursor or page-based pagination on every list endpoint.
- Use async/await, never unhandled promises. Wrap Express async handlers so errors reach the error middleware.
- Frontend: server components by default; client components only when interactivity is needed. Data fetching through a single API client module (TanStack Query for client-side caching).
- Naming: `camelCase` for variables/functions, `PascalCase` for components/types, `kebab-case` for file names, `snake_case` for DB columns and tables (map in the ORM).
- Keep commits small and focused. Use Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).

## Domain Rules

### Users and Verification
- Registration requires email and password; email must be verified before a user can list or transact.
- Passwords hashed with **argon2** (or bcrypt with cost >= 12). Never log or return password hashes.
- Auth: short-lived access token (JWT, ~15 min) plus rotating refresh token in an `httpOnly`, `Secure`, `SameSite` cookie. Support logout and token revocation.
- Roles: `user`, `admin`. Enforce authorization server-side on every protected route; never trust the client.
- Optional identity/phone verification adds a `verified` badge; keep this state separate from email verification.

### Listings
- A listing has: owner, title, description, category, condition, price (nullable for exchange-only), `listing_type` (`sale`, `exchange`, `both`), images, location, status.
- Statuses: `draft`, `active`, `reserved`, `sold`, `exchanged`, `removed`.
- Only the owner (or an admin) can edit or delete a listing. A listing in an active deal cannot be deleted.
- Images: upload directly to S3 via pre-signed URLs; validate type and size; strip EXIF location data.
- Search and filters: keyword, category, price range, condition, location, listing type, sort (newest, price, relevance). Back every filter with an index.

### Deal Workflow (sale and exchange)
State machine, implemented explicitly (no ad-hoc status strings):

```
proposed -> accepted -> (payment pending) -> completed
proposed -> rejected
proposed -> cancelled (by proposer)
accepted -> cancelled (with defined refund/release rules)
accepted -> disputed -> resolved (admin)
```

- A **proposal** is either a purchase offer (price) or an exchange offer (one or more of the proposer's listings, with optional cash top-up).
- Accepting a proposal must, in one database transaction: lock the listing(s), mark them `reserved`, reject or hold competing proposals, and create the deal record.
- Prevent double-selling with row locks (`SELECT ... FOR UPDATE`) or optimistic versioning.
- Every state transition is recorded in an audit/history table with actor and timestamp.
- Users cannot propose on their own listings.

### Payments
- Hide the gateway behind a `PaymentProvider` interface (`createPayment`, `capture`, `refund`, `payout`) so Stripe and Razorpay are swappable.
- **Never handle raw card data.** Use hosted checkout or client-side elements (Stripe Checkout/Elements, Razorpay Checkout).
- Amounts stored as integers in the smallest currency unit, with an explicit currency code. Never use floating point for money.
- Webhooks are the source of truth for payment state: verify signatures, make handlers **idempotent**, and store event IDs to ignore duplicates.
- Use idempotency keys on all create/charge/refund calls.
- Funds flow: hold payment at acceptance, release to the seller on confirmed completion (use Stripe Connect or equivalent). Document platform fee handling in `docs/payments.md`.
- Maintain a `transactions` table (payment intent ID, status, amount, fee, currency, deal ID) and a ledger-style record for refunds and payouts.
- Test with gateway test keys only. Never commit live keys.

### Notifications
Send automated emails (through a background queue, with retries) for at least:
- Email verification and password reset
- New proposal received; proposal accepted; proposal rejected
- Payment received, payment failed, refund issued
- Deal completed; deal cancelled or disputed
- Listing removed by admin

Keep templates in one place (React Email or MJML), support plain-text fallback, and include unsubscribe/preference handling for non-essential emails. Never send sensitive data (full tokens, payment details) in email bodies.

### Admin Dashboard
- Protected by the `admin` role plus server-side checks; consider mandatory 2FA for admins.
- Features: user list/search/suspend/ban, listing moderation (approve, remove), transactions and disputes view, reported-content queue, basic metrics (signups, active listings, GMV).
- Every admin action is written to an audit log (who, what, when, before/after).

## Security Requirements

- Validate and sanitize all input; use parameterized queries only (ORM or prepared statements).
- Set security headers (Helmet), strict CORS allowlist, and CSRF protection for cookie-based auth.
- Rate-limit auth, search, and proposal endpoints; add brute-force protection and account lockout/backoff on login.
- Secrets live in environment variables or a secret manager (AWS Secrets Manager / Vercel env). **Never commit secrets**; keep `.env.example` current with placeholder values.
- Verify webhook signatures; restrict webhook routes to raw body parsing.
- Enforce object-level authorization (users can only access their own deals, drafts, and profile data).
- Limit upload types and sizes; scan or re-encode images.
- Do not leak sensitive data in logs or error responses. Redact tokens, emails where practical, and payment identifiers.
- Run `npm audit` and dependency updates regularly (Dependabot/Renovate).
- Follow the OWASP Top 10 as the baseline checklist.

## Performance Guidelines

- Index every foreign key and every column used in filters, sorts, and joins; check slow queries with `EXPLAIN ANALYZE`.
- Paginate all list endpoints; never return unbounded result sets.
- Avoid N+1 queries (use relation includes/joins deliberately).
- Cache hot, read-heavy data (categories, popular listings) in Redis with clear invalidation.
- Next.js: use ISR/SSG where content allows, `next/image` for images, route-level code splitting, and avoid large client bundles.
- Serve images through a CDN (CloudFront/Vercel) with appropriate sizes and formats (WebP/AVIF).
- Move slow work (emails, image processing, webhooks follow-up) to background jobs.

## Testing

- **Unit tests** (Vitest or Jest): services, state machine transitions, validators, utilities.
- **Integration tests**: API routes against a real PostgreSQL test database (Docker/testcontainers), not mocks, for anything touching transactions or constraints.
- **E2E tests** (Playwright): registration -> verification -> listing -> proposal -> acceptance -> payment (test mode) -> completion.
- Mock external services (gateway, email) at the provider-interface boundary; include webhook replay and duplicate-event tests.
- Every bug fix gets a regression test. New features ship with tests.
- Target meaningful coverage on critical paths (auth, deal state machine, payments) rather than a blanket percentage.

## Deployment

- **Frontend**: Vercel (preview deployments per PR, production from `main`).
- **API**: containerized (Docker) and deployed to AWS (ECS Fargate or Elastic Beanstalk) behind a load balancer, with health check endpoint `/health`.
- **Database**: managed PostgreSQL (AWS RDS or equivalent) with automated backups and point-in-time recovery. Run migrations as a deploy step (`prisma migrate deploy`), never auto-generate in production.
- **CI/CD** (GitHub Actions): on every PR run lint, typecheck, tests, and build; deploy only when all pass.
- Separate `development`, `staging`, and `production` environments with separate databases, keys, and webhook endpoints.
- Add logging (structured JSON), error tracking (Sentry), and uptime/metrics monitoring.

## Agent Working Rules

1. **Read before writing.** Inspect existing code, schema, and conventions before adding anything. Follow patterns already in the repo.
2. **Make focused changes.** Do only what the task asks. Do not refactor unrelated code or rename things unprompted.
3. **Ask when blocked on a product decision** (fees, refund policy, dispute rules) instead of guessing. Note assumptions in the PR description.
4. **Never** commit secrets, edit applied migrations, disable tests to make them pass, or bypass auth/validation to "make it work".
5. **Database changes** always come with a migration, updated seed data if needed, and consideration of existing data.
6. **Do not add new dependencies** without a clear reason; prefer what is already in the stack.
7. **Update docs** (`README`, `docs/`, `.env.example`, API docs) when behavior, config, or endpoints change.
8. **Finish with verification**: run lint, typecheck, and tests, and report what passed and what could not be run.

## Definition of Done

- Feature works end to end and handles error and edge cases.
- Input validation and authorization are in place.
- Tests added or updated and passing; lint and typecheck clean.
- Migrations included if the schema changed.
- Docs and `.env.example` updated.
- No secrets, debug logs, or dead code left behind.

## Suggested Build Order

1. Project setup, tooling, CI, and database schema.
2. Auth: registration, login, email verification, profiles.
3. Listings: CRUD, image upload, browse, search, filters.
4. Deal workflow: proposals, accept/reject/cancel, state machine.
5. Payments: checkout, webhooks, transactions, refunds.
6. Email notifications (queue and templates).
7. Admin dashboard and moderation tools.
8. Hardening: security review, performance tuning, E2E tests, production deployment.
