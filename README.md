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

| Command | Project | Description |
| --- | --- | --- |
| `npm run dev` | both | Start the development server |
| `npm run build` | both | Production build |
| `npm run start` | server | Run the built API from `dist/` |
| `npm run lint` | both | ESLint |
| `npm run typecheck` | both | Type-check; the client runs `next typegen` first |
| `npm run test` | both | Run the unit and integration suites once |
| `npm run test:watch` | both | Run tests in watch mode |
| `npm run format` | both | Format with Prettier |
| `npm run db:migrate` | server | Create and apply a Prisma migration, then regenerate the client |
| `npm run db:deploy` | server | Apply committed migrations without generating (staging/production) |
| `npm run db:generate` | server | Regenerate the Prisma client into `server/src/generated/` |
| `npm run db:reset` | server | Drop, recreate, and re-migrate the dev database |
| `npm run db:studio` | server | Open Prisma Studio |

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

| Variable | Example | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `PORT` | `4000` | API port |
| `CLIENT_URL` | `http://localhost:3000` | Only origin allowed by CORS |
| `DATABASE_URL` | `postgresql://marketplace:marketplace@localhost:5432/marketplace` | Must match `docker-compose.yml` |
| `REDIS_URL` | `redis://localhost:6379` | Local Redis |
| `TEST_DATABASE_URL` | `postgresql://marketplace:marketplace@localhost:5432/marketplace_test` | Test database; the name must end in `_test` |
| `LOG_LEVEL` | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace`, or `silent` |

The server validates these variables at startup and exits with a list of the
missing or malformed ones. It never reads `process.env` anywhere else.

### Client (`client/.env.local`)

| Variable | Example | Notes |
| --- | --- | --- |
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
