# API contract

Base URL: `/api/v1`. JSON in, JSON out. Every response carries an
`X-Request-Id` header; the same value appears in error bodies.

All endpoints in this file are implemented in the current tree.

## Response shapes

Success (design rules B2):

```json
{ "data": {}, "meta": {} }
```

`meta` is optional. List endpoints add `meta.nextCursor`, which is `null` on the
last page.

Error, always:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "issue": "Too small: expected string to have >=1 characters"
      }
    ],
    "requestId": "ef8a1c9e-5d6b-4f2a-9f0a-2b7c1d3e4f56"
  }
}
```

`details` is omitted when there is nothing field-specific. `code` is stable and
UPPER_SNAKE; clients switch on it. Unknown failures never include stack traces,
SQL, or internal paths.

Status codes: `200` OK, `201` Created, `204` No Content, `400` malformed,
`401` unauthenticated, `403` forbidden, `404` not found, `409` conflict,
`413` body too large, `422` validation failed, `429` rate limited,
`500` unexpected, `503` dependency unavailable.

## Operational endpoints (unversioned)

These are infrastructure probes, not business endpoints. They are not under
`/api/v1` so load balancers and uptime checks have a stable path.

### `GET /health/live`

Process liveness. Never touches the database or Redis.

```json
{
  "data": {
    "status": "ok",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-18T10:00:00.000Z"
  }
}
```

### `GET /health/ready` and `GET /health`

Readiness. Checks Postgres (`SELECT 1`) and Redis (`PING`) in parallel.
Returns `200` when both are up, `503` otherwise. `/health` is an alias for
`/health/ready`.

```json
{
  "data": {
    "status": "ok",
    "checks": { "database": "up", "redis": "up" },
    "timestamp": "2026-11-18T10:00:00.000Z"
  }
}
```

Degraded response (`503`):

```json
{
  "data": {
    "status": "degraded",
    "checks": { "database": "up", "redis": "down" },
    "timestamp": "2026-11-18T10:00:00.000Z"
  }
}
```

## `GET /api/v1/ping`

Probe for the versioned API. Demonstrates validation and the error envelope.

| Query  | Type   | Rules                                       |
| ------ | ------ | ------------------------------------------- |
| `name` | string | optional, 1 to 50 characters after trimming |

Success `200`:

```json
{
  "data": { "message": "pong, Ada" },
  "meta": { "requestId": "ef8a1c9e-5d6b-4f2a-9f0a-2b7c1d3e4f56" }
}
```

Validation failure `422`:

```bash
curl "http://localhost:4000/api/v1/ping?name="
```

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "name",
        "issue": "Too small: expected string to have >=1 characters"
      }
    ],
    "requestId": "ef8a1c9e-5d6b-4f2a-9f0a-2b7c1d3e4f56"
  }
}
```

## `GET /`

Service index. Lists the version, health path, and API prefix.

```json
{
  "data": {
    "service": "marketplace-api",
    "version": "v1",
    "health": "/health",
    "api": "/api/v1"
  }
}
```

## Authentication

Two credentials, on purpose:

| Credential    | Where it lives                                                                                        | Lifetime   | Sent as                          |
| ------------- | ----------------------------------------------------------------------------------------------------- | ---------- | -------------------------------- |
| Access token  | JavaScript memory on the client, never `localStorage`                                                 | 15 minutes | `Authorization: Bearer <token>`  |
| Refresh token | `marketplace_refresh` cookie, `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/api/v1/auth` | 30 days    | Cookie, only to `/api/v1/auth/*` |

The access token is a stateless HS256 JWT carrying `sub` (user id), `sid`
(session id), and `role`. Because it is stateless, a role change or a logout
takes effect for at most 15 minutes unless the session is denylisted (logout
does that). Refresh re-reads the user from the database, so a suspended account
cannot refresh.

On page load the client calls `POST /auth/refresh` once. A `401` means no
session and is a normal state, not an error to surface.

Refresh tokens rotate on every use. Presenting an already-rotated token within
10 seconds is treated as a concurrent tab and answered `401`; later than that it
is treated as token theft and the whole token family is revoked.

### Error codes

| Code                     | Status | Meaning                                                                                             |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`       | 422    | Body or params failed validation; `details` names the fields                                        |
| `INVALID_CREDENTIALS`    | 401    | Wrong password, unknown email, or deleted account (deliberately identical, and equalized in timing) |
| `ACCOUNT_SUSPENDED`      | 403    | Password was correct but the account is suspended                                                   |
| `EMAIL_IN_USE`           | 409    | Registration with an address that already has an account, or an email change to one |
| `EMAIL_UNCHANGED`        | 409    | Email change requested to the address already on the account                                        |
| `EMAIL_ALREADY_VERIFIED` | 409    | Resending a confirmation for an address that is already confirmed                                   |
| `EMAIL_NOT_VERIFIED`     | 403    | The action needs a confirmed address                                                                |
| `INVALID_PASSWORD`       | 400    | The current password supplied to a settings action is wrong                                         |
| `INVALID_TOKEN`          | 400    | Email verification, password reset, email change, or phone verification token is unknown, expired, or already used |
| `PHONE_ALREADY_VERIFIED` | 409    | The phone number is already verified on this account                                                |
| `UNAUTHENTICATED`        | 401    | Missing, malformed, or expired access token; or no refresh cookie on refresh                        |
| `INVALID_REFRESH_TOKEN`  | 401    | Refresh cookie is unknown, revoked, or expired                                                      |
| `FORBIDDEN`              | 403    | Authenticated but the role is not allowed                                                           |
| `ORIGIN_NOT_ALLOWED`     | 403    | Browser write came from an origin other than `CLIENT_URL`                                           |
| `RATE_LIMITED`           | 429    | Too many attempts; `Retry-After` says how many seconds to wait                                      |
| `NOT_FOUND`              | 404    | The resource does not exist or is not visible to this caller                                        |
| `INVALID_SIGNATURE`      | 401    | A payment webhook had a missing or invalid HMAC signature                                           |
| `INVALID_TRANSITION`     | 409    | A deal state change is not allowed by the state machine                                             |
| `PROPOSAL_EXISTS`        | 409    | The buyer already has a pending proposal on the listing                                             |
| `LISTING_NOT_AVAILABLE`  | 409    | The listing is no longer active / is already part of a deal                                         |
| `INVALID_STATUS`         | 409    | The deal is in the wrong state for the requested action                                             |
| `NOT_A_SALE_DEAL`        | 422    | The deal has no price (exchange deals are not paid through checkout)                               |

### Rate limits

| Endpoint                         | Bucket                                            | Limit                                 |
| -------------------------------- | ------------------------------------------------- | ------------------------------------- |
| `POST /auth/register`            | per IP                                            | 5 per hour                            |
| `POST /auth/login`               | per email (SHA-256 hashed as the key), and per IP | 10 per 15 minutes / 30 per 15 minutes |
| `POST /auth/refresh`             | per IP                                            | 60 per 15 minutes                     |
| `POST /auth/verify-email`        | per IP                                            | 30 per 15 minutes                     |
| `POST /auth/verify-email/resend` | per user                                          | 3 per hour                            |
| `POST /auth/password/forgot`     | per email and per IP                              | 5 per hour / 10 per hour              |
| `POST /auth/password/reset`      | per IP                                            | 10 per 15 minutes                     |
| `POST /auth/password/change`     | per user                                          | 5 per 15 minutes                      |
| `POST /auth/email/change`        | per user                                          | 3 per hour                            |
| `POST /auth/email/change/confirm`| per IP                                            | 30 per 15 minutes                     |
| `GET /auth/account/export`       | per user                                          | 5 per hour                            |
| `DELETE /auth/account`           | per user                                          | 3 per hour                            |
| `PATCH /profiles/me`             | per user                                          | 30 per hour                           |
| `GET /profiles/:userId`          | per IP                                            | 120 per 15 minutes                    |
| `POST /auth/phone/send`          | per user                                          | 3 per hour                            |
| `POST /auth/phone/verify`        | per user                                          | 10 per 15 minutes                     |
| `POST /auth/phone/resend`        | per user                                          | 3 per hour                            |
| `POST /listings`                 | per user                                          | 10 per hour                           |
| `PATCH /listings/:listingId`     | per user                                          | 20 per hour                           |
| `DELETE /listings/:listingId`    | per user                                          | 20 per hour                           |
| `POST /listings/:listingId/publish`| per user                                        | 20 per hour                           |
| `GET /listings`                  | per IP                                            | 120 per 15 minutes                    |
| `GET /listings/:listingId`       | per IP                                            | 60 per 15 minutes                     |
| `GET /listings/categories`       | per IP                                            | 60 per 15 minutes                     |
| `POST /listings/categories`      | per user (admin)                                  | 10 per hour                           |
| `POST /listings/:id/images/presign`| per user                                         | 30 per hour                           |
| `POST /listings/:id/images/complete`| per user                                        | 30 per hour                           |
| `DELETE /listings/:id/images/:imageId`| per user                                      | 30 per hour                           |
| `PATCH /listings/:id/images/reorder`| per user                                        | 30 per hour                           |

The limiter uses Redis. If Redis is unavailable the limiter fails open and logs
a warning: a cache outage must not lock everyone out of signing in.

### `POST /api/v1/auth/register`

Body, both required:

| Field      | Rules                                                      |
| ---------- | ---------------------------------------------------------- |
| `email`    | trimmed, lowercased, valid address, at most 254 characters |
| `password` | 10 to 200 characters                                       |

`201`, sets the refresh cookie, `Location: /api/v1/auth/me`:

```json
{
  "data": {
    "user": {
      "id": "84ce834c-0e98-4a5f-bff1-8178e651f6d4",
      "email": "person@example.com",
      "role": "USER",
      "status": "ACTIVE",
      "emailVerified": false,
      "phoneVerified": false,
      "createdAt": "2026-11-18T18:26:56.325Z",
      "displayName": "",
      "bio": "",
      "location": ""
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  },
  "meta": { "requestId": "ef8a1c9e-5d6b-4f2a-9f0a-2b7c1d3e4f56" }
}
```

The response intentionally reveals that an address is taken (`409`
`EMAIL_IN_USE`), because the alternative is a confirmation email the user may
never receive. The per-IP limit is what keeps that from becoming a bulk account
enumeration tool.

### `POST /api/v1/auth/login`

Same body as registration. `200` with the same payload. A missing account and a
wrong password both return `401 INVALID_CREDENTIALS`, and the missing-account
path verifies a dummy hash so the two take the same time.

### `POST /api/v1/auth/refresh`

No body; reads the refresh cookie. `200` with a new `accessToken`, a rotated
cookie, and the current user. `401` when there is no usable session.

### `POST /api/v1/auth/logout`

No body, no access token required. `204`, clears the cookie, revokes the refresh
session, and denylists the session id for the remaining access-token lifetime.
Calling it twice is safe.

### `GET /api/v1/auth/me`

Requires `Authorization`. `200`:

```json
{
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "role": "USER",
      "status": "ACTIVE",
      "emailVerified": false,
      "phoneVerified": false,
      "createdAt": "...",
      "displayName": "Ade Balogun",
      "bio": "Trades cameras and bike parts.",
      "location": "Lagos"
    }
  }
}
```

### `GET /api/v1/auth/sessions`

Lists the caller's active, unexpired sessions, newest first. `current` marks the
session the access token belongs to.

```json
{
  "data": {
    "sessions": [
      {
        "id": "2468cd86-c10d-440a-9133-1e4c46af0bef",
        "userAgent": "Mozilla/5.0 ...",
        "ip": "::1",
        "createdAt": "2026-11-18T18:26:56.343Z",
        "expiresAt": "2026-12-18T18:26:56.097Z",
        "current": true
      }
    ]
  }
}
```

### `DELETE /api/v1/auth/sessions/:sessionId`

Revokes one of the caller's own sessions. `204` on success. Revoking the current
session also clears the cookie and denylists the access token. A session that
belongs to another user is `404`, not `403`: the response never confirms that a
guessed id exists.

### Email verification and password reset

Registration sends a confirmation link. Only a SHA-256 hash of the token is
stored, it expires (24 hours for verification, 1 hour for reset), and it is
single use. The client receives the token in the link, then posts it back, so a
mail scanner that prefetches the URL cannot spend the token.

Nothing is delivered by the API itself: messages go through a BullMQ queue to an
`EmailProvider`. `EMAIL_PROVIDER=console` (local development) logs the full text
body so the link can be copied from the API output; `brevo` delivers through the
Brevo API. Delivery failures are retried three times with exponential backoff.

#### `POST /api/v1/auth/verify-email`

Body: `{ "token": "<token from the link>" }`. `200` with the updated user.
`400 INVALID_TOKEN` when the token is unknown, expired, or already used;
`422` when the body is malformed.

```json
{ "data": { "user": { "id": "...", "emailVerified": true } } }
```

The access token does not change; the next `/auth/me` and refresh read the new
state from the database.

#### `POST /api/v1/auth/verify-email/resend`

Requires `Authorization`. `202` with `{ "data": { "status": "queued" } }`. The
previous link stops working once a new one is issued. `409
EMAIL_ALREADY_VERIFIED` when the address is already confirmed.

#### `POST /api/v1/auth/password/forgot`

Body: `{ "email": "person@example.com" }`. Always `202` with `{ "data":
{ "status": "accepted" } }`, whether or not the address has an account, so this
endpoint cannot be used to check who is registered. Suspended accounts are
silently skipped.

#### `POST /api/v1/auth/password/reset`

Body: `{ "token": "<token from the link>", "password": "<new password>" }`. `204`
on success. Sets the new password, revokes every session for the account, and
invalidates the token in one transaction. `400 INVALID_TOKEN` for an unknown,
expired, or used token; `422` for a password that breaks the rules.

Because sessions are revoked, the client drops its access token and asks the
user to sign in again. A previously issued access token remains valid until it
expires (at most 15 minutes), which is the documented cost of a stateless token.

#### Confirmed addresses

`requireVerifiedEmail` is applied to actions that need a confirmed address:
listing creation and proposal submission (added in those chunks). It returns
`403 EMAIL_NOT_VERIFIED` and reads the database rather than the token, because
the token was minted before the user clicked the link.

## Profiles

Public profile data lives in a separate `profiles` table, created in the same
transaction as the account. It is split from `users` so a public read can never
select the email address or the password hash by accident.

### `GET /api/v1/profiles/:userId`

Public; no session required. `200`:

```json
{
  "data": {
    "profile": {
      "id": "...",
      "displayName": "Ade Balogun",
      "bio": "Trades cameras and bike parts.",
      "location": "Lagos",
      "memberSince": "2026-11-18T18:26:56.325Z",
      "emailVerified": true,
      "phoneVerified": false
    }
  }
}
```

Missing, suspended, and deleted accounts all return `404 NOT_FOUND`, so the
outside world cannot tell a banned member from one who never existed. A
malformed id returns `422`. The response never contains the email address,
role, or status.

### `PATCH /api/v1/profiles/me`

Requires `Authorization` and a trusted `Origin`. Body: at least one of

| Field         | Rules                                                       |
| ------------- | ----------------------------------------------------------- |
| `displayName` | 1 to 60 characters after trimming, single line              |
| `bio`         | 0 to 500 characters after trimming, line breaks allowed     |
| `location`    | 0 to 80 characters after trimming, single line              |

Unknown keys are rejected with `422`. On success, `200` with the complete user:

```json
{ "data": { "user": { "id": "...", "displayName": "Ade Balogun", "bio": "...", "location": "Lagos" } } }
```

Returning the user rather than just the profile lets the client replace its
cached session in one round trip.

## Account settings

All endpoints below require `Authorization`. Password changes, email changes,
and deletion also require the **current password** in the body: a borrowed
session alone must not be able to move the account or destroy it. Browser
requests must also carry a trusted `Origin`.

### `POST /api/v1/auth/password/change`

Body: `{ "currentPassword": "...", "newPassword": "..." }`. `204` on success.

Every other session for the account is revoked and denylisted immediately; the
session that made the request stays signed in. `400 INVALID_PASSWORD` when the
current password is wrong, `422` when the new one breaks the policy.

### `POST /api/v1/auth/email/change`

Body: `{ "newEmail": "new@example.com", "password": "..." }`. `202` with
`{ "data": { "status": "queued" } }`.

A confirmation link is sent to the **new** address, because receiving it is the
proof that the user controls that inbox. The link expires after one hour and
works once. Until it is confirmed, the old address stays on the account.

| Error              | Status | When                                            |
| ------------------ | ------ | ----------------------------------------------- |
| `INVALID_PASSWORD` | 400    | The supplied password is wrong                  |
| `EMAIL_UNCHANGED`  | 409    | The new address is already the current one      |
| `EMAIL_IN_USE`     | 409    | Another account already uses the new address    |

### `POST /api/v1/auth/email/change/confirm`

Body: `{ "token": "<token from the link>" }`. Public: the token is the
credential, so this works on a phone that is not signed in. `200`:

```json
{ "data": { "email": "new@example.com", "userId": "..." } }
```

Confirmation marks the new address verified in the same transaction. `400
INVALID_TOKEN` for an unknown, expired, or used token; `409 EMAIL_IN_USE` if the
address was taken while the link was waiting.

### `GET /api/v1/auth/account/export`

`200` with `Content-Disposition: attachment` and a JSON document:

```json
{
  "data": {
    "exportedAt": "2026-11-18T20:00:00.000Z",
    "account": { "id": "...", "email": "...", "role": "USER", "status": "ACTIVE", "emailVerified": true, "phoneVerified": false, "createdAt": "...", "updatedAt": "..." },
    "profile": { "displayName": "...", "bio": "...", "location": "...", "createdAt": "...", "updatedAt": "..." },
    "sessions": [{ "id": "...", "userAgent": "...", "ip": "...", "createdAt": "...", "expiresAt": "...", "revokedAt": null }]
  }
}
```

Password hashes, refresh-token hashes, and action tokens are deliberately
excluded: an export is for the user's records, not a credential dump.

### `DELETE /api/v1/auth/account`

Body: `{ "password": "..." }`. `204` on success.

The account is **anonymized, not deleted**. The row stays so future listings,
deals, and audit records can still reference it; the email becomes
`deleted+<id>@deleted.invalid`, the password hash becomes an unusable random
value, the status becomes `DELETED`, the profile fields are cleared, and every
session and action token is removed. `400 INVALID_PASSWORD` when the password is
wrong. The response clears the refresh cookie.

### `POST /api/v1/auth/phone/send`

Requires `Authorization` and a trusted `Origin`. Body:

| Field  | Rules                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `phone`| E.164 format (`+` followed by country code and 7 to 15 digits)         |

`202` with `{ "data": { "status": "queued" } }`. A 6-digit code is sent to the
number by SMS. `409 PHONE_ALREADY_VERIFIED` when the number is already
verified. `422` when the number fails the E.164 check.

### `POST /api/v1/auth/phone/verify`

Requires `Authorization` and a trusted `Origin`. Body:

| Field  | Rules           |
| ------ | --------------- |
| `phone`| E.164 phone number |
| `code` | Exactly 6 digits |

`204` on success. The phone number is written to the account and marked
verified. `400 INVALID_TOKEN` for an unknown, expired, or already-spent code,
or when the number does not match the pending token.

### `POST /api/v1/auth/phone/resend`

Requires `Authorization` and a trusted `Origin`. Body:

| Field  | Rules                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `phone`| E.164 phone number |

`202` with `{ "data": { "status": "queued" } }`. Sends a fresh code and
replaces the pending token, just like `send`.

## Listings

Listings are items a member offers for sale or exchange. A listing starts as a
`draft` and must be published to become visible to other members. Only the
listing owner can edit or delete it, and a listing that is part of an active
deal (reserved, sold, or exchanged) cannot be changed.

Listings require a verified email address to create, but anyone can browse
published listings without signing in.

### `POST /api/v1/listings`

Requires `Authorization`, a verified email, and a trusted `Origin`. Body:

| Field         | Rules                                                                       |
| ------------- | --------------------------------------------------------------------------- |
| `title`       | 1 to 200 characters after trimming                                          |
| `description` | 1 to 2000 characters after trimming                                         |
| `condition`   | `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, or `POOR` (default `GOOD`)               |
| `priceCents`  | whole cents ≥ 0 (required when `listingType` is `SALE` or `BOTH`)           |
| `listingType` | `SALE`, `EXCHANGE`, or `BOTH` (default `BOTH`)                              |
| `categoryId`  | optional UUID of an existing category                                       |
| `location`    | 1 to 200 characters after trimming                                          |

`201` with `{ "data": { "listing": <ListingDto> } }`. The listing is created as
a draft.

`422 PRICE_REQUIRED` when a sale or both listing has no price.

### `GET /api/v1/listings`

Public; no session required. Query params:

| Field       | Rules                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| `category`  | optional category UUID or slug                                          |
| `condition` | optional `NEW`, `LIKE_NEW`, `GOOD`, `FAIR`, `POOR`                      |
| `listingType` | optional `SALE`, `EXCHANGE`, `BOTH`                                   |
| `minPrice`  | optional whole cents ≥ 0                                                |
| `maxPrice`  | optional whole cents ≥ 0                                                |
| `q`         | keyword search on title/description: full-text (`@@`) plus trigram substring matches, ≤ 200 chars |
| `location`  | optional case-insensitive substring, backed by a trigram index          |
| `sort`      | `newest` (default), `price_asc`, `price_desc`, `relevance` (rank by `q`) |
| `status`    | optional listing status filter                                          |
| `limit`     | 1 to 100, default 20                                                    |
| `cursor`    | opaque base64 token from `nextCursor`; encodes the last row's sort key  |

`200` with
`{ "data": { "listings": [<ListingDto>], "nextCursor": "...", "total": 42 } }`.
Only `ACTIVE` listings are returned. `total` is the number of listings matching
the filters before pagination. `nextCursor` is null on the last page.

Full-text search uses a generated `tsvector` column (title weighted above
description) with a GIN index; `pg_trgm` indexes on title, description, and
location make substring filters and partial keywords fast.

### `GET /api/v1/listings/:listingId`

Public; no session required. `200` with `{ "data": { "listing": <ListingDto> } }`.
`404` if missing or not visible.

### `PATCH /api/v1/listings/:listingId`

Requires `Authorization`, a trusted `Origin`, and ownership. Body: at least one
of the fields above. `200` with the updated listing.

`403 FORBIDDEN` if not the owner. `409 LISTING_IN_DEAL` if the listing is part
of an active deal.

### `DELETE /api/v1/listings/:listingId`

Requires `Authorization`, a trusted `Origin`, and ownership. `204` on success.

`403 FORBIDDEN` if not the owner. `409 LISTING_IN_DEAL` if the listing is part
of an active deal.

### `POST /api/v1/listings/:listingId/publish`

Requires `Authorization`, a trusted `Origin`, and ownership. `200` with the
published listing. Changes status from `DRAFT` to `ACTIVE`.

### `GET /api/v1/listings/categories`

Public; no session required. `200` with:

```json
{ "data": { "categories": [{ "id": "...", "name": "...", "slug": "...", "activeListingCount": 5 }] } }
```

### `POST /api/v1/listings/categories`

Requires `Authorization`, `ADMIN` role, and a trusted `Origin`. Body:

| Field | Rules                                                        |
| ----- | ------------------------------------------------------------ |
| `name`| 1 to 100 characters after trimming                           |
| `slug`| 1 to 100 lowercase alphanumeric + hyphens, e.g. `electronics`|

`201` with `{ "data": { "category": <CategoryDto> } }`. `409` if the slug is
already in use.

## Deals

A deal begins as a sale proposal from a buyer on an active listing and moves
through an explicit state machine. Every transition is appended to an audit
history with the actor and timestamp. Only the buyer and seller of a deal may
read it. Listing reservation and competing-proposal rejection happen atomically
under a row lock when a proposal is accepted.

State machine (later chunks add payment, completion, and dispute transitions):

- `PROPOSED` → `ACCEPTED` (seller) / `REJECTED` (seller) / `CANCELLED` (buyer)
- `ACCEPTED` → `CANCELLED` / `PAYMENT_PENDING`

All deal routes require `Authorization`; writes also require a trusted `Origin`.
Creating a proposal additionally requires a verified email address.

### `POST /api/v1/deals`

Body: `{ "listingId": "<uuid>", "amountCents": <int > 0> }`. `201` with
`{ "data": { "deal": <DealDto> } }`. Rejections: `422` for your own listing,
an exchange-only listing, or a duplicate pending proposal; `409` when the
listing is not active; `403` when the email is unverified.

### `POST /api/v1/deals/exchange`

Creates an exchange proposal. Body:
`{ "listingId": "<uuid>", "offeredListingIds": ["<uuid>", ...], "topUpCents"?: <int> }`.
Every offered listing must be one of the buyer's own ACTIVE listings; the target
listing must accept exchanges. `201` with the deal, whose `offeredListings`
array lists the offered items. Accepting the deal reserves **all** listings
involved (target + offered) and rejects competing proposals touching any of
them. `422` for invalid offered listings or an empty list.

### `GET /api/v1/deals`

Query: `role` (`buyer`, `seller`, `all`), `status`, `limit`, `cursor`. `200` with
`{ "data": { "deals": [<DealDto>], "nextCursor": "..." } }`. Returns only deals
where the caller is a participant.

### `GET /api/v1/deals/:dealId`

`200` with the full deal including its `history` array. `404` if missing, `403`
if the caller is not a participant.

### `POST /api/v1/deals/:dealId/accept`

Seller only. `200` with the accepted deal. Marks the listing `RESERVED` and
rejects every competing proposal (with a history entry for each). `409` when
the deal is not `PROPOSED` or the listing is no longer available.

### `POST /api/v1/deals/:dealId/reject`

Seller only. Moves a `PROPOSED` deal to `REJECTED`. `200` with the updated deal.

### `POST /api/v1/deals/:dealId/cancel`

Buyer only. Moves a `PROPOSED` deal to `CANCELLED`. `200` with the updated deal.

A `DealDto` includes the listing title, both participants and their display
names, type, amount, status, timestamps, the history array, and (for swaps) the
offered listings.

### Deal thread

Each deal has a message thread for arranging the handoff. Only the buyer and
seller may read or post; the service checks participant access on every call.

#### `GET /api/v1/deals/:dealId/messages`

Query: `limit` (default 50), `cursor`. `200` with
`{ "data": { "messages": [<DealMessage>], "nextCursor": "..." } }`, oldest first.

#### `POST /api/v1/deals/:dealId/messages`

Body: `{ "body": "<1-2000 chars>" }`. `201` with `{ "data": { "message": <DealMessage> } }`.

A `DealMessage` has `id`, `dealId`, `senderId`, `body`, and `createdAt`.

## Payments

Payments go through the `PaymentProvider` interface (`createPayment`, `capture`,
`refund`, `payout`), swappable without touching callers. The current `test`
provider issues deterministic fake checkout URLs; no real card data ever
reaches the API — the buyer uses hosted checkout. All amounts are integer
minor units (cents) with an explicit currency. The webhook is the source of
truth for payment state.

### `POST /api/v1/payments/checkout`

Requires `Authorization` and a trusted `Origin`; only the **buyer** of an
`ACCEPTED` sale deal may call it. Body: `{ "dealId": "<uuid>" }`. `201` with
`{ "data": { "checkoutUrl", "amountCents", "currency", "provider" } }`. Creates
a `PENDING` transaction; retries reuse it (idempotent).

### `GET /api/v1/payments/transaction?dealId=<uuid>`

`200` with the latest `Transaction` for the deal, or `404` if none.

### `GET /api/v1/payments/transactions`

`200` with all transactions where the caller is buyer or seller.

A `Transaction` has `id`, `dealId`, `provider`, `providerPaymentId`,
`amountCents`, `feeCents`, `currency`, `status` (`PENDING`, `SUCCEEDED`,
`FAILED`, `REFUNDED`), and timestamps.

### `POST /api/v1/payments/webhook`

No session — the HMAC signature over the **raw body** is the credential. Header
`x-webhook-signature` is the hex HMAC-SHA256 of the body using `WEBHOOK_SECRET`.
Body:

```json
{ "id": "evt_...", "type": "payment.succeeded", "data": { "providerPaymentId": "..." } }
```

`200` with `{ "data": { "received": true, "alreadyProcessed": boolean, "changed": boolean } }`.
Handlers are idempotent: the unique `providerEventId` is recorded once, and a
replayed event changes nothing. A genuine `payment.succeeded` marks the
transaction `SUCCEEDED` and moves the deal to `PAYMENT_PENDING` with a history
entry, atomically. Invalid signatures return `401 INVALID_SIGNATURE`.

### Exchange dual-lock handoff

Exchange deals complete only after **both** parties confirm the handoff. A pure
exchange (no cash top-up) moves to `PAYMENT_PENDING` on acceptance; an exchange
with a cash top-up reaches it after the buyer pays. Each party calls
`POST /api/v1/deals/:dealId/handoff/confirm` once. One-sided confirmation
leaves the deal pending with that side's `buyerConfirmedAt` / `sellerConfirmedAt`
timestamp recorded. When the second confirmation arrives, the deal becomes
`COMPLETED` and any cash top-up held in escrow is released via payout —
atomically. A repeat confirmation from the same party is a no-op.

`POST /api/v1/deals/:dealId/handoff/confirm` returns
`{ "data": { "status", "buyerConfirmedAt", "sellerConfirmedAt", "completed" } }`.

### Handoff code

Sale deals use the one-time handoff code below; exchange deals use dual
confirmation instead. Handoff is the step where the buyer inspects the item and the seller confirms
receipt to release funds. Only available while the deal is `PAYMENT_PENDING`.
The code is a 6-digit value; only its SHA-256 hash is stored, it expires after
`HANDOFF_CODE_TTL_MINUTES`, and wrong attempts are limited to
`HANDOFF_MAX_ATTEMPTS` before a new code is required.

#### `POST /api/v1/deals/:dealId/handoff/reveal`

Buyer only. `200` with `{ "data": { "code": "482 915", "expiresAt": "..." } }`.
The plaintext is returned to the buyer only and never stored.

#### `POST /api/v1/deals/:dealId/handoff/complete`

Seller only. Body: `{ "code": "482 915" }`. On the correct code, the deal
becomes `COMPLETED`, a `PAYOUT` ledger entry records the seller's release, and
funds are sent to the seller's connected account — atomically. Wrong codes
return `400 INVALID_HANDOFF_CODE` and count toward the attempt limit;
`410 HANDOFF_CODE_EXPIRED` and `429 HANDOFF_ATTEMPTS_EXCEEDED` are also possible.

A completed deal has `status: COMPLETED`, a `completedAt` timestamp, and no
stored handoff code.

### `POST /api/v1/payments/payout/onboard`

Requires `Authorization` and a trusted `Origin`. Body: `{ "country": "US" }`
(two-letter code). Creates the gateway connected account (idempotent) and
returns `{ "data": { "onboarded": true, "accountId": "..." } }`. The account id
is gateway-private and never appears in public user data.

### `GET /api/v1/payments/payout/status`

`200` with `{ "data": { "onboarded": boolean, "onboardedAt": string|null } }`.

A seller who is not onboarded cannot accept a paid deal (`403
PAYOUT_NOT_ONBOARDED`).

## Deal and payment emails

Transactional emails are queued through the existing BullMQ email worker and
sent once per event. A `notification_events` row keyed by
`deal:event:recipient` makes every notification idempotent, so a replayed
webhook or retried transition never duplicates a message. Email delivery
failures are logged and never block a deal state change.

Emails are sent for: new proposal (seller), proposal accepted (buyer), proposal
rejected (buyer), deal cancelled (counterparty), funds secured (both parties),
handoff completed (both parties), and refund issued (buyer). Every message uses
the shared transactional layout with a plain-text fallback and never contains
tokens or payment secrets.

### Listing images

Images are uploaded directly to S3-compatible storage using presigned URLs. The
API never receives raw image bytes: it hands out a presigned PUT URL, the client
uploads the file, then the client confirms the upload so the API records the
image. A listing can hold at most 10 images.

All image routes require `Authorization` and a trusted `Origin`, and the caller
must own the listing. A listing that is part of an active deal cannot have its
images changed.

#### `POST /api/v1/listings/:listingId/images/presign`

Body:

| Field              | Rules                                                       |
| ------------------ | ----------------------------------------------------------- |
| `contentType`      | `image/jpeg`, `image/png`, `image/webp`, or `image/gif`     |
| `sizeBytes`        | 1 to 8 MiB                                                  |
| `suggestedFilename`| 1 to 255 characters                                         |

`200` with `{ "data": { "upload": { "key", "url", "fields", "contentType" } } }`.
The client PUTs the file to `url` with the supplied content type, then calls
`complete` with the returned `key`. `409 IMAGE_LIMIT_REACHED` when the listing
already has 10 images. `403` for a non-owner.

#### `POST /api/v1/listings/:listingId/images/complete`

Body: `{ "key": "<key returned by presign>" }`. `200` with
`{ "data": { "image": <ListingImageDto> } }`. The image is appended at the next
position. `409 IMAGE_LIMIT_REACHED` when the listing already has 10 images.

#### `DELETE /api/v1/listings/:listingId/images/:imageId`

`204` on success. Removes the image record and the stored object. `403` if the
caller does not own the image's listing.

#### `PATCH /api/v1/listings/:listingId/images/reorder`

Body: `{ "imageIds": ["<uuid>", ...] }` — the desired display order (at least
one, at most 10). `204` on success. Sets `position` by array index.

Images are returned on every listing response under `images`, sorted by
`position`. A `ListingImageDto` is:

```json
{
  "id": "...",
  "key": "listings/<listingId>/<uuid>.jpg",
  "url": "https://cdn.example.com/listings/<listingId>/<uuid>.jpg",
  "mimeType": "image/jpeg",
  "sizeBytes": 12345,
  "width": null,
  "height": null,
  "position": 0
}
```

### `GET /api/v1/admin/users`

Administrators only (`ADMIN` role, enforced server-side).

| Query    | Type   | Rules                                                                  |
| -------- | ------ | ---------------------------------------------------------------------- |
| `q`      | string | optional, 1 to 200 characters, case-insensitive substring of the email |
| `limit`  | number | 1 to 100, default 20                                                   |
| `cursor` | uuid   | optional, the last user id from the previous page                      |

```json
{
  "data": {
    "users": [
      {
        "id": "...",
        "email": "...",
        "role": "ADMIN",
        "status": "ACTIVE",
        "emailVerified": true,
        "phoneVerified": false,
        "createdAt": "..."
      }
    ]
  },
  "meta": {
    "requestId": "...",
    "nextCursor": "2de42e79-4acb-4e1c-8189-8b6a7db5b7f5"
  }
}
```

`nextCursor` is `null` on the last page. User objects never include the password
hash.

## Disputes

Either participant may open a dispute while a deal's funds are secured
(`PAYMENT_PENDING`). Opening a dispute moves the deal to `DISPUTED`, which
freezes the escrow-expiry refund processor. Only one dispute may exist per deal,
and only an admin may resolve one. Resolution moves money via the gateway and
records ledger entries, then marks the dispute `RESOLVED` and the deal
`RESOLVED`. Resolving twice is rejected (`409 DISPUTE_RESOLVED`).

Resolution options:
- `RELEASE` — all net funds to the seller
- `REFUND` — all net funds back to the buyer
- `SPLIT` — half to each side (seller gets `floor(net/2)`)

Both parties are emailed once about the outcome.

### `POST /api/v1/disputes`

Requires `Authorization` and a trusted `Origin`. Body:
`{ "dealId": "<uuid>", "reason": "<10-2000 chars>" }`. `201` with the dispute.

### `GET /api/v1/disputes/deal/:dealId`

Returns the dispute for a deal, or `404` if none. Participants only.

### `GET /api/v1/disputes`

Admin only. Returns all disputes, newest first.

### `PATCH /api/v1/disputes/:disputeId/resolve`

Admin only. Body:
`{ "resolution": "RELEASE" | "REFUND" | "SPLIT", "note"?: string }`.
`200` with the resolved dispute.

## Reviews and trust

A member may review the other participant of a **completed** deal, once per
deal. Ratings are 1-5 and an optional comment (up to 2000 chars). The review
subject is derived from the deal — a client cannot choose whom to review. A
user's public profile shows a trust badge (average rating and review count),
and the seller card on a listing shows the same signal.

### `POST /api/v1/reviews`

Requires `Authorization` and a trusted `Origin`. Body:
`{ "dealId": "<uuid>", "rating": 1-5, "comment"?: string }`. `201` with the
review. `409 DEAL_NOT_COMPLETED` if the deal is not complete; `403` for a
non-participant; `409 REVIEW_EXISTS` on a duplicate.

### `GET /api/v1/reviews?userId=<uuid>`

Public. Paginated (`limit`, `cursor`) reviews received by a user, newest first.

### `GET /api/v1/reviews/trust?userId=<uuid>`

Public. Returns `{ "data": { "averageRating": 4.5, "reviewCount": 12 } }`.

### `GET /api/v1/reviews/mine?dealId=<uuid>`

Authenticated. Returns the caller's review for a deal, or `null`.

### Admin dashboard endpoints

All endpoints below require the `ADMIN` role. Every mutation writes an
append-only audit entry with the actor, action, target, and before/after values.

#### `PATCH /api/v1/admin/users/:userId`

Body: `{ "status": "ACTIVE" | "SUSPENDED" }`. Cannot suspend yourself.
Suspending also revokes all of the user's active sessions. `422 SELF_ACTION`
when targeting your own account.

#### `GET /api/v1/admin/listings`

Query: `status`, `limit`, `cursor`. Returns a paginated overview of listings
across all statuses.

#### `PATCH /api/v1/admin/listings/:listingId`

Body: `{ "action": "remove" | "restore", "reason"?: string }`. `remove` moves a
listing to `REMOVED`; `restore` only works on removed listings.

#### `GET /api/v1/admin/settings`

Returns `{ "data": { "settings": { "platformFeeBps", "escrowWindowDays" } } }`.
Values come from the database, falling back to the environment defaults.

#### `PATCH /api/v1/admin/settings`

Body: at least one of `platformFeeBps` (0-5000) or `escrowWindowDays` (1-90).
Changes take effect immediately for new checkouts and escrow windows.

#### `GET /api/v1/admin/audit`

Query: `limit`, `cursor`. Returns newest-first audit events with `action`,
`targetType`, `targetId`, `before`, `after`, `actorId`, and `createdAt`.
