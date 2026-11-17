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

   The API listens on <http://localhost:4000>. `GET /` returns `{ "ok": true }`.

3. Start the web app in a second terminal:

   ```bash
   cd client
   cp .env.example .env.local
   npm install
   npm run dev
   ```

   Open <http://localhost:3000>.

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
| `npm run format` | both | Format with Prettier |

## Project structure

```
/
├── client/               # Next.js frontend (App Router)
├── server/               # Express API
├── docs/                 # Architecture notes and API contract (later chunks)
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
