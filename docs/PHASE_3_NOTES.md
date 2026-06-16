# Phase 3 Notes

Phase 3 adds the first product-facing observability layer: tenant-scoped monitored services and manual HTTP uptime checks.

## Existing monitoring context

Before Phase 3, the repo already had:

- AWS account registration and EC2 sync.
- Instance inventory APIs.
- VictoriaMetrics query proxy with tenant labels.
- Alert rule storage and evaluator.
- Notification channels.
- API-key hashing foundation.

The new service registry complements those pieces. AWS/instance inventory describes infrastructure. `MonitoredService` describes the customer-facing service or endpoint an organization wants to monitor.

## Service model design

Added `MonitoredService` with:

- `organizationId` for tenant scope.
- `name`, `slug`, `description`.
- `type`: `HTTP`, `API`, `WEB`, `EC2`, `CUSTOM`.
- `environment`: string defaulting to `production`.
- HTTP check configuration: `url`, `healthPath`, `method`, `expectedStatusCode`, `timeoutMs`, `intervalSeconds`.
- `tags` JSON.
- derived status fields: `currentStatus`, `lastCheckedAt`, `lastResponseTimeMs`.
- `createdByUserId`.
- `deletedAt` for soft delete.

Validation:

- `name` and `type` are required.
- `HTTP`, `API`, and `WEB` services require a URL.
- `method` is limited to `GET` and `HEAD`.
- `expectedStatusCode` must be `100` through `599`.
- `timeoutMs` must be `1000` through `30000`.
- `intervalSeconds` must be `30` through `3600`.
- request bodies are strict, so client-supplied `organizationId` is rejected.

## Uptime check model design

Added `UptimeCheck` with:

- `organizationId` and `serviceId`.
- `status`: `UP`, `DOWN`, `DEGRADED`, `UNKNOWN`.
- optional HTTP status code and response time.
- safely truncated error message.
- `checkedAt`.
- `checkSource`, defaulting to `manual`.
- optional metadata JSON.

No response bodies, headers, credentials, or large payloads are stored.

## API routes added

- `POST /api/services`
- `GET /api/services`
- `GET /api/services/:id`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `POST /api/services/:id/check`

All routes require an authenticated active organization membership.

Role permissions:

- `OWNER`, `ADMIN`, and `DEVELOPER`: create, update, soft-delete, and manually check services.
- `VIEWER`: list/read services only.

Tenant rules:

- All reads/writes use `req.user.organizationId`.
- Service lookup is scoped by active organization.
- Cross-org service IDs return not found.
- Delete is soft delete.

## Manual uptime check behavior

`POST /api/services/:id/check`:

- loads the service from the active org only,
- supports `HTTP`, `API`, and `WEB` services,
- performs a real HTTP request using built-in `fetch`,
- enforces a timeout using `AbortController`,
- uses `redirect: "manual"` so the checker does not follow redirects blindly,
- measures response time,
- stores one `UptimeCheck` row,
- updates the service's derived latest status fields,
- logs an audit event.

Status rules:

- `UP`: expected status code returned within normal time.
- `DEGRADED`: expected status code returned slowly, or unexpected non-5xx status returned.
- `DOWN`: request failed, timed out, had no status, or returned an unexpected 5xx.
- `UNKNOWN`: service has never been checked.

The slow threshold is currently `80%` of configured timeout.

## SSRF and security considerations

Added basic SSRF protections:

- only `http` and `https` URLs are allowed,
- URLs with embedded credentials are rejected,
- `localhost`, `.localhost`, and `metadata.google.internal` are blocked,
- literal private, loopback, link-local, and unspecified IPs are blocked,
- DNS results resolving to private/blocked IPs are blocked,
- redirects are not followed.

Remaining limitations:

- DNS rebinding protection is basic.
- IPv6/private range handling is intentionally conservative but not exhaustive.
- Production-grade probing should run in isolated workers with egress controls.

## API key ingestion

Deferred in Phase 3.

Reason:

- The service registry and manual check persistence are now in place.
- API key middleware exists from Phase 2.
- Ingestion semantics should be designed with Phase 4 worker/scheduler behavior so external writes do not conflict with first-party checks.

Recommended later route:

- `POST /api/ingest/uptime-check`
- require API key auth with a dedicated scope such as `uptime:write` or a clearly documented existing scope,
- validate service ownership against the API key organization.

## Audit logging

Added audit writes for:

- `service.created`
- `service.updated`
- `service.deleted`
- `service.check_triggered`

Audit logging remains best-effort and does not crash primary actions.

## Migration notes

Added migration:

- `backend/prisma/migrations/20260616020000_service_uptime_monitoring/migration.sql`

Migration adds:

- `monitored_services`
- `uptime_checks`
- enums for service type, method, and uptime status
- indexes for tenant filtering and service/check lookups

Manual notes:

- Apply after the Phase 2 migrations.
- Existing AWS instances are not automatically converted into services.
- If service slugs collide within an organization, creation will fail until a unique name is chosen.

## Validation results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | Backend entrypoint syntax check. |
| `npm test` | Passed | 43 tests passed. |
| `$env:DATABASE_URL='mysql://sidroid_user:local-dev-password@localhost:3306/sidroid'; npx prisma validate` | Passed | Safe local placeholder URL. |
| `$env:DATABASE_URL='mysql://sidroid_user:local-dev-password@localhost:3306/sidroid'; npx prisma generate` | Passed | Regenerated local Prisma client after schema change. |
| `docker compose --env-file .env.example config` | Passed | Run from `docker/` with placeholder env values. |

## Phase 4 recommendations

- Add durable workers/schedulers for periodic uptime checks.
- Add retry/backoff and check concurrency controls.
- Add probe-region/source support.
- Add API-key-authenticated ingestion after scope design.
- Add alert rules that can target service uptime.
- Add integration tests with a disposable MySQL database.
