# Staging deployment

Chunk 4 asks for a hello-world staging deploy where the frontend reads the API's
`/health` endpoint. The application-side pieces are in place (CI, test suites,
API status UI). What remains needs accounts, credentials, and a domain that this
repository does not have.

## The one hard requirement: one registrable domain

The refresh cookie is `httpOnly`, `Secure`, and `SameSite=Lax`, scoped to
`/api/v1/auth`. That only works when the client and API are subdomains of the
same registrable domain:

- `https://app.example.com` (Next.js on Vercel)
- `https://api.example.com` (Express on AWS)

`*.vercel.app` plus an AWS hostname are different registrable domains. The
cookie would be dropped and authentication cannot be exercised on staging. Do
not "fix" this with `SameSite=None`.

Local development is unaffected: `localhost:3000` and `localhost:4000` are
same-site.

## Frontend: Vercel

1. Import the repository in Vercel and set the project root to `client/`.
2. Framework preset: Next.js. Build command and output use the defaults.
3. Environment variables for Preview and Production:
   - `NEXT_PUBLIC_API_URL=https://api.example.com`
4. Add `app.example.com` as the production domain and keep preview URLs for
   pull requests.
5. Pull requests get a preview deployment automatically once the repository is
   connected.

## API: AWS

Target shape (details land in chunk 30):

- **Runtime**: container on ECS Fargate behind an Application Load Balancer.
- **Database**: RDS PostgreSQL, separate instances per environment.
- **Cache**: ElastiCache Redis.
- **Storage/secrets**: Secrets Manager for `DATABASE_URL`, `REDIS_URL`, and
  (from chunk 5) token secrets.
- **Health check**: the load balancer targets `GET /health` and expects `200`.
  The endpoint returns `503` when Postgres or Redis is unreachable, so a bad
  deploy is removed from rotation.
- **Migrations**: run `npm run db:deploy` as a one-off task before the new
  service revision starts. Never run `prisma migrate dev` outside development.
- **Proxy**: `NODE_ENV=production` enables `trust proxy`, so rate limits and
  `Secure` cookies see the real client IP. The ALB must set
  `X-Forwarded-For` and `X-Forwarded-Proto`.
- **CORS**: set `CLIENT_URL=https://app.example.com` exactly, with no trailing
  slash.

## Environment variables on staging

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `4000` |
| `CLIENT_URL` | `https://app.example.com` |
| `DATABASE_URL` | RDS connection string |
| `REDIS_URL` | ElastiCache connection string |
| `LOG_LEVEL` | `info` |

## Verification checklist

- [ ] `https://api.example.com/health` returns `200` with both checks `up`.
- [ ] `https://app.example.com` loads and shows "All systems operational".
- [ ] Stopping the API shows the error state, and restarting it recovers with
      "Check again".
- [ ] A pull request runs lint, typecheck, test, and build for both projects.
- [ ] `app.` and `api.` share one registrable domain (required before chunk 5).

Chunk 5 adds the refresh cookie. Staging cannot test it until the domain above
is settled.
