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
- **Storage/secrets**: Secrets Manager for `DATABASE_URL`, `REDIS_URL`,
  `JWT_ACCESS_SECRET`, `BREVO_API_KEY`, and the seed admin password.
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
- **Email**: the API process also runs the BullMQ worker, so no separate service
  is needed. Jobs are distributed across tasks if the service scales out. Brevo
  requires a verified sender address and a key with transactional email access.

## Environment variables on staging

| Variable                   | Value                                                          |
| -------------------------- | -------------------------------------------------------------- |
| `NODE_ENV`                 | `production`                                                   |
| `PORT`                     | `4000`                                                         |
| `CLIENT_URL`               | `https://app.example.com`                                      |
| `DATABASE_URL`             | RDS connection string                                          |
| `REDIS_URL`                | ElastiCache connection string                                  |
| `JWT_ACCESS_SECRET`        | 48 random bytes; generate per environment, never reuse locally |
| `ACCESS_TOKEN_TTL_SECONDS` | `900`                                                          |
| `REFRESH_TOKEN_TTL_DAYS`   | `30`                                                           |
| `EMAIL_PROVIDER`           | `brevo` (required in production)                               |
| `EMAIL_FROM_ADDRESS`       | verified sender, e.g. `no-reply@example.com`                   |
| `EMAIL_FROM_NAME`          | `P2P Marketplace`                                              |
| `BREVO_API_KEY`            | Brevo API key from Secrets Manager                             |
| `LOG_LEVEL`                | `info`                                                         |
| `SMS_PROVIDER`             | `console` in development; a real SMS provider in production    |
| `STORAGE_PROVIDER`         | `s3` (required in production for listing images)               |
| `S3_BUCKET`                | S3 bucket for listing images, from Secrets Manager             |
| `S3_REGION`                | bucket region, e.g. `us-east-1`                                |
| `S3_ACCESS_KEY_ID`         | S3 access key from Secrets Manager                             |
| `S3_SECRET_ACCESS_KEY`     | S3 secret key from Secrets Manager                             |
| `S3_PUBLIC_URL`            | CDN or bucket public URL prefix, e.g. `https://cdn.example.com`|
| `S3_ENDPOINT`              | optional, for S3-compatible services (MinIO, R2)              |
| `S3_FORCE_PATH_STYLE`      | `true` for MinIO, otherwise `false`                            |

## Verification checklist

- [ ] `https://api.example.com/health` returns `200` with both checks `up`.
- [ ] `https://app.example.com` loads and shows "All systems operational".
- [ ] Registering on `app.` sets the refresh cookie on `app.`, and a full page
      reload keeps the user signed in.
- [ ] Signing out, then reloading, leaves the user signed out.
- [ ] A new registration receives a confirmation email from the verified sender,
      and the link confirms the address on `app.`.
- [ ] "Forgot password" delivers a reset link that changes the password and
      signs out other devices.
- [ ] A member can save a display name, bio, and location, and the public page
      at `/users/<id>` shows them without the email address.
- [ ] Changing the password keeps this device signed in and signs out another
      browser.
- [ ] Changing the email delivers a link to the new address, and confirming it
      makes the new address the sign-in address.
- [ ] "Download my data" saves a JSON file with no password hash or token.
- [ ] Deleting an account signs out every device and removes the public profile.
- [ ] A member can request a phone verification code by SMS, enter it, and see
      the "Phone verified" badge on their profile.
- [ ] A seller can add, delete, and reorder photos on a listing, and the images
      load from the configured bucket/CDN on the public listing page.
- [ ] A guest can browse `/browse`, use "Load more" to reach the end without
      skipped listings, and open a detail page at `/listings/<id>` with a seller
      card, gallery, and SEO title/description.
- [ ] A keyword plus filters (category, condition, type, price, location, sort)
      returns correct results, the URL can be shared and restored with the back
      button, and the result count matches the filters.
- [ ] Stopping the API shows the error state, and restarting it recovers with
      "Check again".
- [ ] A pull request runs lint, typecheck, test, and build for both projects.
- [ ] `app.` and `api.` share one registrable domain (required for the
      `SameSite=Lax` refresh cookie).

Chunk 6 adds transactional email. Staging cannot confirm Brevo delivery until
the domain above is settled and a verified sender exists.

Chunk 7 finishes the account flows. The email-change message uses the same
Brevo sender, so it is covered by the same requirement.

Chunk 8 adds phone verification. SMS delivery uses `SMS_PROVIDER=console`
in development (codes appear in the API log). Staging needs a real SMS
provider configured before the phone flows can be exercised end to end.

Chunk 9 adds listings and categories. Members can create draft listings,
publish them, edit or delete their own listings, and browse public listings
with filters and pagination. The sell page at `/sell` requires a verified
email address.

Chunk 10 adds listing images. Uploads go straight to S3-compatible storage via
presigned URLs; `S3_BUCKET` and the `S3_*` credentials must be configured for the
image flows to work on staging. Locally and in tests, `STORAGE_PROVIDER=memory`
keeps uploads in RAM, so no bucket is needed. A production bucket also needs a
public read policy or CDN origin access so the returned image URLs are visible
to buyers.

Chunk 11 adds the public browse feed and listing detail pages. Both work for
signed-out guests and need no extra credentials beyond the storage bucket above.

Chunk 12 adds search and filtering. `20261123000000_add_listing_search` enables
the `pg_trgm` extension, a generated tsvector column, and GIN/btree indexes; the
migration runs as a deploy step like all others, so no manual database setup is
needed.

