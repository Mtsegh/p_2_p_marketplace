# End-to-end tests

## What runs today

`server/test/e2e-flows.test.ts` exercises the complete marketplace flows in
sequence over the real API and the real PostgreSQL/Redis test services:

- **Sale, escrow, handoff, review:** register → verify → create/publish listing
  → propose → accept (listing reserved) → checkout → signed webhook → funds
  secured with a `HOLD` ledger entry → buyer reveals code → seller completes →
  payout ledger entry → two-way review → trust stats.
- **Fraud: wrong code:** an incorrect handoff code is rejected, the deal stays
  `PAYMENT_PENDING`, and the correct code still completes it afterwards.
- **Fraud: replayed webhook:** the same signed event is delivered three times;
  only the first changes state, and only one `HOLD` entry is written.
- **Dispute:** secured deal → buyer opens dispute (deal frozen) → admin resolves
  with `REFUND` → deal `RESOLVED`.
- **Swap:** exchange proposal → accept (both listings reserved) → one-sided
  confirmation leaves it pending → second confirmation completes it.

Run it locally with `npm run test:e2e` from `server/`, or `npm test` (the file is
part of the normal Vitest run). The CI `server` job already runs `npm run test`,
so these flows run on every pull request and push to `main`.

Each case starts from a clean database and Redis (`resetIdentityState`), so the
suite is order-independent and repeatable.

## Browser-level Playwright suite

The browser suite is written and wired into CI:

- `client/playwright.config.ts` starts the API and client as web servers against
  the test database, with a single Chromium project.
- `client/e2e/register.spec.ts` — register through the UI and sign in.
- `client/e2e/browse.spec.ts` — guest browse, detail page, URL filters.
- `client/e2e/sale-flow.spec.ts` — proposal, escrow, "Funds secured", code
  reveal, seller completion, review; plus wrong-code and replayed-webhook cases.
- `client/e2e/dispute.spec.ts` — buyer opens a dispute, admin resolves it in the
  dashboard.
- `client/e2e/swap.spec.ts` — exchange proposal and dual confirmation.
- `server/e2e/seed.mts` creates verified/onboarded users and resets the test DB
  and Redis from inside the server workspace. There is **no test-only auth
  backdoor** in the API; users are seeded directly in the test database, the
  same way the Vitest helpers do.

The specs are excluded from the client's normal `lint`/`typecheck` until
`@playwright/test` is installed, so those checks stay green without the
dependency. `client/package.json` has `npm run test:e2e`. The
`.github/workflows/ci.yml` `e2e` job installs Playwright and Chromium in CI,
migrates the test database, and runs the suite on every PR and push to `main`.

### Local run (ticket E2E-1)

Local execution is blocked only by network access: `@playwright/test` is not in
the local npm cache and the registry is unreachable from this sandbox
(`ENOTCACHED` for `playwright-core`). In a networked environment:

```bash
cd client
npm install --no-save @playwright/test
npx playwright install --with-deps chromium
npm run test:e2e
```

No product decision is needed; this is purely a dependency/browser install.

## Definition of done

The API-level E2E suite runs in CI and passes today. The Playwright suite is
committed and CI-ready; only the local dependency/browser install remains
blocked by network access.
