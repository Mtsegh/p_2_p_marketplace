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

## Browser-level Playwright suite (ticket E2E-1)

The roadmap also calls for Playwright browser flows. This could not be
completed in the local environment:

- `@playwright/test` is not in `client/package.json` and is not in the local npm
  cache.
- The npm registry is unreachable from this sandbox (`socket hang up` on the
  audit endpoint, `ENOTCACHED` for `playwright-core` on an offline install), so
  the dependency, its lockfile entry, and browser binaries cannot be installed
  or verified here.

Steps for a networked environment (no user decisions required):

```bash
cd client
npm install -D @playwright/test
npx playwright install --with-deps chromium
npx playwright test
```

Then add a `test:e2e` script to `client/package.json` and a CI job that runs
`npm ci`, `npx playwright install --with-deps chromium`, and `npm run test:e2e`
against the API (`npm run dev` in `server/`) and client (`npm run dev`) started
as web servers in the Playwright config. Seed verified users with a
`globalSetup` that creates them through Prisma against the test database; do
not add a test-only authentication backdoor to the API.

Recommended browser specifications (the API-level equivalents already pass):

1. Register → verify email → create a listing → publish → open it.
2. Browse with filters → open detail → submit an offer → accept as seller.
3. Buyer pays → sees "Funds secured" → reveals code → seller completes → both
   leave a review.
4. Wrong code and expired code scenarios.
5. Dispute opened by buyer → resolved by admin in the dashboard.
6. Swap proposal → dual confirmation.
7. Replayed webhook (API request within the browser test context).

## Definition of done

The API-level E2E suite runs in CI and passes today. Browser-level E2E is
blocked purely by dependency/network access and is tracked as **E2E-1**; no
product decision is needed to finish it.
