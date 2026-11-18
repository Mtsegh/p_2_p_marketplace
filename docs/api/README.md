# API contract

Base URL: `/api/v1`. JSON in, JSON out. Every response carries an
`X-Request-Id` header; the same value appears in error bodies.

All endpoints in this file are implemented in the current tree.

## Response shapes

Success (design rules B2):

```json
{ "data": { }, "meta": { } }
```

`meta` is optional. Lists will add `meta.nextCursor` when they exist.

Error, always:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "field": "name", "issue": "Too small: expected string to have >=1 characters" }],
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

| Query | Type | Rules |
| --- | --- | --- |
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
    "details": [{ "field": "name", "issue": "Too small: expected string to have >=1 characters" }],
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

No authenticated endpoints exist yet. Chunk 5 adds `/api/v1/auth/*` and updates
this document in the same change.
