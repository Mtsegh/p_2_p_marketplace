# P2P Marketplace

A peer-to-peer marketplace where people list items to sell or exchange with each
other. This repository contains the Next.js frontend (`client/`) and the
Express API (`server/`); each is installed, run, and deployed on its own.

## Prerequisites

- Node.js 22 or newer (Node 24 recommended)
- npm 10 or newer
- Docker Desktop (or another Docker engine) for PostgreSQL and Redis

## Quick start

1. Start the local services (PostgreSQL on `5432`, Redis on `6379`):

   ```bash
   docker compose up -d
   ```

   Wait until both containers report `healthy`:

   ```bash
   docker compose ps
   ```

2. Start the API:

   ```bash
   cd server
   cp .env.example .env
   npm install
   npm run dev
   ```

   The API listens on <http://localhost:4000>. `GET /health` returns `200` when
   Postgres and Redis are reachable.

3. Start the web app in a second terminal:

   ```bash
   cd client
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>. The home page shows live API status and
   reports when the API cannot be reached.

The environment files (`.env`, `.env.local`) hold local secrets and are
gitignored. Every new environment variable must be added to the matching
`.env.example` file and to `server/src/config/env.ts`.

## Scripts

Run these from inside `client/` or `server/` as noted.

| Command               | Project | Description                                                        |
| --------------------- | ------- | ------------------------------------------------------------------ |
| `npm run dev`         | both    | Start the development server                                       |
| `npm run build`       | both    | Production build                                                   |
| `npm run start`       | server  | Run the built API from `dist/`                                     |
| `npm run lint`        | both    | ESLint                                                             |
| `npm run typecheck`   | both    | Type-check; the client runs `next typegen` first                   |
| `npm run test`        | both    | Run the unit and integration suites once                           |
| `npm run test:watch`  | both    | Run tests in watch mode                                            |
| `npm run format`      | both    | Format with Prettier                                               |
| `npm run db:migrate`  | server  | Create and apply a Prisma migration, then regenerate the client    |
| `npm run db:deploy`   | server  | Apply committed migrations without generating (staging/production) |
| `npm run db:generate` | server  | Regenerate the Prisma client into `server/src/generated/`          |
| `npm run db:reset`    | server  | Drop, recreate, and re-migrate the dev database                    |
| `npm run db:seed`     | server  | Create or reset the development admin account                      |
| `npm run db:studio`   | server  | Open Prisma Studio                                                 |

### Database workflow

The schema and migrations live in `prisma/` at the repository root. The Prisma
CLI configuration lives in `server/prisma.config.ts`, so run Prisma commands
from `server/`:

```bash
cd server
npm run db:migrate        # after editing prisma/schema.prisma
npm run db:generate       # after pulling schema changes
```

Generated Prisma client code (`server/src/generated/`) is gitignored and is
recreated by the server's `postinstall` hook, `npm run db:generate`, or
`npm run db:migrate`. Prisma 7 does not run `prisma generate` automatically
after `migrate dev`, which is why the migrate script chains both.

### Testing

The client suite is pure unit tests (Vitest + jsdom-free `node` environment).
The server suite runs API integration tests with Supertest against a real
PostgreSQL database named `marketplace_test`, so constraints and transactions
are exercised rather than mocked.

Create the test database once. It is separate from the development database and
safe to reset:

```bash
docker compose exec postgres psql -U marketplace -d postgres \
  -c "CREATE DATABASE marketplace_test OWNER marketplace"
```

On a brand-new Docker volume the init script at
`docker/postgres/init/01-create-test-database.sql` creates it automatically. If
the database already exists, the command above fails with "already exists" and
that is fine. To rebuild the volume from scratch, run
`docker compose down -v` (this deletes the development data too).

Then:

```bash
cd server
npm run test
```

`server/test/global-setup.ts` applies the committed migrations to
`TEST_DATABASE_URL` before the suites run. It refuses to start unless the
database name ends in `_test`, so a mistyped URL cannot wipe development data.
The suites share one database and run serially; each test that writes data must
clean up after itself.

```bash
cd client
npm run test
```

Set `TEST_DATABASE_URL` in `server/.env` (see the table below). Without it, the
harness falls back to the same local `marketplace_test` URL.

Server tests also use a separate Redis database (`redis://localhost:6379/1`, or
`TEST_REDIS_URL` when set) so rate-limit counters and the logout denylist do not
collide with the development API. Each suite flushes that database before it
starts.

### Accounts and sessions

Registration, sign-in, session listing, and session revocation are in place. The
access token is kept in memory on the client; the refresh token is an
`HttpOnly`, `SameSite=Lax` cookie scoped to `/api/v1/auth`, so a page reload
quietly trades it for a new access token.

Seed the development administrator once:

```bash
cd server
npm run db:seed
```

That creates `admin@example.com` with the password `dev-admin-password`, or
resets it if it already exists. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`
to use different values; seeding with `NODE_ENV=production` requires an explicit
password.

Two deployment constraints come with this design, both documented in
[`docs/staging.md`](docs/staging.md):

- The client and API must be subdomains of one registrable domain (`app.` and
  `api.`) so the refresh cookie is same-site. Cross-site hosts need
  `SameSite=None`, which also means third-party cookie blocking applies.
- `CLIENT_URL` must be the exact client origin. Auth writes reject any other
  `Origin` header, which is what replaces a CSRF token here.

### Email verification and password reset

Registration sends a confirmation link through a BullMQ queue. The API process
runs the worker too, so local development needs no extra service beyond Redis.
Emails go through a small `EmailProvider` interface:

- `EMAIL_PROVIDER=console` (the default) writes the full text of the message to
  the API log, including the link. Copy it from the terminal to finish a
  verification or reset locally.
- `EMAIL_PROVIDER=brevo` sends through Brevo. Set `BREVO_API_KEY`, and make sure
  `EMAIL_FROM_ADDRESS` is a verified sender in the Brevo account. The server
  refuses to start in production with any other provider, so a forgotten key
  cannot silently stop password resets.

Links expire (24 hours to confirm an address, 1 hour to reset a password) and
work once. Resetting a password signs out every device. Listing creation and
proposals require a confirmed address; the profile page has a resend button for
the link.

### Profiles and account settings

Public profile data (display name, bio, location) lives in its own `profiles`
table, created together with the account. Every member gets a public page at
`/users/<id>` that never shows the email address; any name or bio left empty is
replaced with neutral wording. Until avatar uploads arrive (chunk 10), the UI
draws initials from the display name.

The `/profile` page also handles the account itself:

- Change password. Every other device is signed out and denylisted; the device
  making the change stays signed in.
- Change email. A confirmation link is sent to the **new** address, expires in
  one hour, and works once. The old address stays usable until it is confirmed.
- Export data. Downloads a JSON document with the account, profile, and session
  history. Password hashes and tokens are never included.
- Delete account. Requires the password. The account is anonymized rather than
  removed, because later listings, deals, and audit records reference it: the
  email, password, profile text, phone number, sessions, and tokens are cleared
  and the status becomes `DELETED`.
- Verify phone. A 6-digit code is sent by SMS. Entering it marks the phone as
  verified and adds a "Phone verified" badge to the public profile. Phone
  verification is required before accepting a paid deal (chunk 8 rule).

### Listings

Listings let members offer items for sale or exchange. The server (`POST
/api/v1/listings`) creates a draft listing; publishing it (`POST
/api/v1/listings/:id/publish`) makes it visible to other members at `GET
/api/v1/listings`. Listings carry a title, description, condition, optional
price (cents), listing type (sale, exchange, or both), optional category, and
location. Only the owner can edit or delete a listing, and a listing that is
part of an active deal cannot be changed.

Public pages:
- `/browse` — listing grid with filters and pagination
- `/sell` — create a draft listing (requires verified email)
- `/users/<id>` — public profile with initials avatar and verified badges

Listing images upload directly to S3-compatible storage through presigned PUT
URLs, so the API never handles raw bytes. The client requests a presigned URL,
PUTs the file, and confirms the upload; the API then records the image. Each
listing holds up to 10 images (JPEG, PNG, WebP, or GIF, 8 MiB each) that can be
deleted and reordered. Locally and in tests, `STORAGE_PROVIDER=memory` keeps
uploads in RAM so no S3 account is needed; production uses `STORAGE_PROVIDER=s3`
with the `S3_*` variables in `server/.env.example`. Image type and size are
validated at presign time on the server and again in the browser before upload.

Guests can browse published listings at `/browse` without signing in. The first
page is server-rendered for a fast first paint; "Load more" uses TanStack Query
to append the next cursor page without a navigation, preserving scroll position.
Each listing has a detail page at `/listings/<id>` with an image gallery
(keyboard arrows on desktop, swipe on touch), price, attributes, description, a
seller trust card, and similar items from the same category. Both pages set SEO
metadata (title, description, and an Open Graph image on the detail page).

The browse feed supports full-text keyword search plus category, condition,
listing type, price range, and location filters, and sorting by newest, price,
or relevance. Search uses PostgreSQL `tsvector` (GIN index) with `pg_trgm`
substring fallback, backed by indexes for every filter. Filters live entirely in
the URL query string, so a search link is shareable and the back button restores
it; typing is debounced 300ms, active filters appear as removable chips, and the
result count is shown. Filter controls sit in a sidebar on desktop and a
collapsible panel on mobile.


### Continuous integration

`.github/workflows/ci.yml` runs lint, typecheck, test, and build for both
projects on every pull request and on pushes to `main`, with PostgreSQL and
Redis service containers. Staging deployment is not automated yet; the required
domain layout and account setup are documented in
[`docs/staging.md`](docs/staging.md).

## Project structure

```
/
├── client/               # Next.js frontend (App Router)
├── server/               # Express API
├── prisma/               # Prisma schema and migrations
├── docs/                 # Design rules, API contract, architecture notes
├── docker-compose.yml    # PostgreSQL and Redis for local development
└── AGENTS.md             # Conventions and working rules
```

## Environment variables

### Server (`server/.env`)

| Variable                   | Example                                                                | Notes                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                 | `development`                                                          | `development`, `test`, or `production`                                                                     |
| `PORT`                     | `4000`                                                                 | API port                                                                                                   |
| `CLIENT_URL`               | `http://localhost:3000`                                                | Only origin allowed by CORS                                                                                |
| `DATABASE_URL`             | `postgresql://marketplace:marketplace@localhost:5432/marketplace`      | Must match `docker-compose.yml`                                                                            |
| `REDIS_URL`                | `redis://localhost:6379`                                               | Local Redis                                                                                                |
| `TEST_DATABASE_URL`        | `postgresql://marketplace:marketplace@localhost:5432/marketplace_test` | Test database; the name must end in `_test`                                                                |
| `TEST_REDIS_URL`           | `redis://localhost:6379/1`                                             | Optional; test Redis database, defaults to `/1`                                                            |
| `JWT_ACCESS_SECRET`        | 48 random bytes, base64url                                             | HMAC key for access tokens; at least 32 characters. Rotating it signs everyone out                         |
| `ACCESS_TOKEN_TTL_SECONDS` | `900`                                                                  | Access token lifetime, 60 to 3600                                                                          |
| `REFRESH_TOKEN_TTL_DAYS`   | `30`                                                                   | Refresh session lifetime, 1 to 90                                                                          |
| `EMAIL_PROVIDER`           | `console`                                                              | `console` logs emails locally, `brevo` delivers them, `memory` is for tests. Must be `brevo` in production |
| `EMAIL_FROM_ADDRESS`       | `no-reply@marketplace.test`                                            | Sender address; with Brevo it must be a verified sender                                                    |
| `EMAIL_FROM_NAME`          | `P2P Marketplace`                                                      | Sender display name                                                                                        |
| `BREVO_API_KEY`            | empty locally                                                          | Brevo API key. Required when `EMAIL_PROVIDER=brevo`                                                        |
| `LOG_LEVEL`                | `info`                                                                 | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent`                                            |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The server validates these variables at startup and exits with a list of the
missing or malformed ones. It never reads `process.env` anywhere else.

### Client (`client/.env.local`)

| Variable              | Example                 | Notes               |
| --------------------- | ----------------------- | ------------------- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Base URL of the API |

## Troubleshooting

- **`docker compose up` fails with a pipe/npipe error**: Docker Desktop is not
  running. Start it and wait until the engine is ready.
- **`port is already allocated`**: something else is using `5432` or `6379`.
  Stop that service or change the port mapping in `docker-compose.yml` and the
  matching URL in `server/.env`.
- **The API exits with `Invalid environment configuration`**: copy
  `server/.env.example` to `server/.env` and check the named variables. The
  message lists every problem.
- **`EADDRINUSE` on `3000` or `4000`**: stop the process using the port, or set
  a different `PORT` in `server/.env`.
- **Server tests fail with a database error**: the `marketplace_test` database
  does not exist yet. Create it with the command in
  [Testing](#testing), or run `docker compose down -v` on a throwaway volume so
  the init script creates it.
