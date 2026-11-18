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

| Code                    | Status | Meaning                                                                                             |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------- |
| `VALIDATION_ERROR`      | 422    | Body or params failed validation; `details` names the fields                                        |
| `INVALID_CREDENTIALS`   | 401    | Wrong password, unknown email, or deleted account (deliberately identical, and equalized in timing) |
| `ACCOUNT_SUSPENDED`     | 403    | Password was correct but the account is suspended                                                   |
| `EMAIL_IN_USE`          | 409    | Registration with an address that already has an account                                            |
| `UNAUTHENTICATED`       | 401    | Missing, malformed, or expired access token; or no refresh cookie on refresh                        |
| `INVALID_REFRESH_TOKEN` | 401    | Refresh cookie is unknown, revoked, or expired                                                      |
| `FORBIDDEN`             | 403    | Authenticated but the role is not allowed                                                           |
| `ORIGIN_NOT_ALLOWED`    | 403    | Browser write came from an origin other than `CLIENT_URL`                                           |
| `RATE_LIMITED`          | 429    | Too many attempts; `Retry-After` says how many seconds to wait                                      |
| `NOT_FOUND`             | 404    | The resource does not exist or is not visible to this caller                                        |

### Rate limits

| Endpoint              | Bucket                                            | Limit                                 |
| --------------------- | ------------------------------------------------- | ------------------------------------- |
| `POST /auth/register` | per IP                                            | 5 per hour                            |
| `POST /auth/login`    | per email (SHA-256 hashed as the key), and per IP | 10 per 15 minutes / 30 per 15 minutes |
| `POST /auth/refresh`  | per IP                                            | 60 per 15 minutes                     |

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
      "createdAt": "2026-11-18T18:26:56.325Z"
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
      "createdAt": "..."
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
