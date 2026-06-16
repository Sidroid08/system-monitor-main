# Sidroid Backend

Express/Prisma control-plane backend for the Sidroid monitoring project.

## Stack

- Node.js with ES modules
- Express 5
- Prisma 5
- MySQL
- JWT and bcrypt authentication
- Organization membership and basic RBAC
- Hashed organization-scoped API keys
- Monitored service registry, manual HTTP checks, and scheduled uptime workers
- Redis/BullMQ for background uptime jobs
- API-key-authenticated logs and metrics ingestion
- JWT-protected telemetry query APIs
- JWT-protected observability visualization APIs
- API rate limiting for auth, ingestion, and expensive read/query routes
- Zod request validation
- VictoriaMetrics query proxy

## Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update local values in `.env`. Do not commit `.env` or real cloud credentials.

3. Install dependencies:

```bash
npm install
```

4. Validate Prisma configuration:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
```

5. Start the backend:

```bash
npm run dev
```

6. Start scheduled uptime monitoring in a separate terminal when Redis is available:

```bash
npm run worker
```

Use `npm run worker:uptime` for a worker-only process and `npm run scheduler:uptime` for a scheduler-only process.

## Validation

```bash
npm run lint
npm test
```

`npm test` runs the fast unit test suite. Optional Docker/MySQL integration tests are gated:

```bash
RUN_INTEGRATION_TESTS=true DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npm run test:integration
```

The Prisma connectivity probe is available separately:

```bash
npm run db:check
```

`db:check` requires a reachable database and should not be treated as a unit test.

## Demo seed

The recruiter/demo flow uses a safe local seed script:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npm run seed
```

It creates a `sidroid-demo` organization, local demo users, monitored services, uptime checks, logs, metrics, alert rules, a sample alert, and a sample incident timeline. It does not print a raw API key. Create a disposable API key through `POST /api/api-keys` for ingestion demos.

## Main API routes

- `GET /health`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/org`
- `GET /api/org/:id`
- `GET /api/aws`
- `POST /api/aws`
- `POST /api/aws/:id/sync`
- `GET /api/instances`
- `GET /api/alert-rules`
- `POST /api/alert-rules`
- `GET /api/notification-channels`
- `POST /api/notification-channels`
- `GET /api/query/instant`
- `GET /api/query/range`
- `GET /api/query/labels`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `POST /api/api-keys/:id/revoke`
- `DELETE /api/api-keys/:id`
- `GET /api/services`
- `POST /api/services`
- `GET /api/services/:id`
- `PATCH /api/services/:id`
- `DELETE /api/services/:id`
- `POST /api/services/:id/check`
- `GET /api/worker-health`
- `GET /api/uptime-alert-rules`
- `POST /api/uptime-alert-rules`
- `GET /api/incidents`
- `POST /api/incidents`
- `GET /api/incidents/:id`
- `PATCH /api/incidents/:id`
- `POST /api/incidents/:id/acknowledge`
- `POST /api/incidents/:id/assign`
- `POST /api/incidents/:id/resolve`
- `POST /api/incidents/:id/close`
- `POST /api/incidents/:id/comments`
- `GET /api/incidents/:id/timeline`
- `POST /api/ingest/logs`
- `POST /api/ingest/metrics`
- `GET /api/logs`
- `GET /api/logs/stats`
- `GET /api/logs/:id`
- `GET /api/metrics`
- `GET /api/metrics/names`
- `GET /api/metrics/aggregate`
- `GET /api/observability/overview`
- `GET /api/observability/services/:serviceId/summary`
- `GET /api/observability/retention/status`
- `GET /api/observability/victoriametrics/health`

Most routes require a bearer token. Tenant-owned routes use the authenticated user's active organization membership.

## Auth and roles

Protected requests require:

- a valid non-expired JWT,
- an active user,
- an active membership in the JWT's organization.

Roles:

- `OWNER`: full org access.
- `ADMIN`: manage most org resources.
- `DEVELOPER`: manage technical resources such as AWS accounts and alert rules.
- `VIEWER`: read-only access.

`User.organizationId` remains as a backward-compatible default organization pointer, while `OrganizationMember` is the membership source of truth.

## API keys

API keys are organization-scoped and hashed before storage. The raw key is returned only once when created.

Supported scopes:

- `metrics:write`
- `logs:write`
- `services:read`
- `alerts:read`

Use `API_KEY_PEPPER` in `.env` for API key hashing. Do not reuse production peppers across environments.

Telemetry ingestion requires scoped API keys:

- `POST /api/ingest/logs`: `logs:write`
- `POST /api/ingest/metrics`: `metrics:write`

The API key organization is the tenant source of truth for ingestion. Clients must not send `organizationId`.

## Rate limiting and telemetry limits

Phase 9 adds configurable rate limits:

```text
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=memory
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX=10
INGEST_RATE_LIMIT_WINDOW_SECONDS=60
INGEST_RATE_LIMIT_MAX=120
QUERY_RATE_LIMIT_WINDOW_SECONDS=60
QUERY_RATE_LIMIT_MAX=300
```

Use `RATE_LIMIT_STORE=redis` when running multiple API replicas. Local/unit tests can disable rate limiting with `RATE_LIMIT_ENABLED=false`.

Telemetry request caps:

```text
TELEMETRY_MAX_ACCEPTED_LOGS_PER_REQUEST=100
TELEMETRY_MAX_ACCEPTED_METRICS_PER_REQUEST=100
```

Extra valid rows over the accepted-row cap are rejected inside the multi-status ingestion response. Full SaaS plan quotas are intentionally deferred.

## Service monitoring

Services are organization-scoped records for customer-facing endpoints or monitored targets.

Supported service types:

- `HTTP`
- `API`
- `WEB`
- `EC2`
- `CUSTOM`

Manual uptime checks currently support `HTTP`, `API`, and `WEB` services. They store status, response time, HTTP status code, and a truncated error message. They do not store response bodies.

Scheduled uptime checks use Redis/BullMQ:

- queue name: `uptime-checks`
- job name: `run-uptime-check`
- job payload: `organizationId`, `serviceId`, `requestedBy`, `source`
- API server does not start schedulers automatically
- `DOWN` is stored as a completed check result, not a failed BullMQ job
- internal worker failures are retried with exponential backoff

Example service:

```json
{
  "name": "Public API",
  "type": "HTTP",
  "environment": "production",
  "url": "https://api.example.com",
  "healthPath": "/health",
  "method": "GET",
  "expectedStatusCode": 200,
  "timeoutMs": 5000,
  "intervalSeconds": 60
}
```

Manual check:

```bash
curl -X POST http://localhost:5000/api/services/<service-id>/check \
  -H "Authorization: Bearer <token>"
```

Worker diagnostics:

```bash
curl http://localhost:5000/api/worker-health \
  -H "Authorization: Bearer <owner-or-admin-token>"
```

Worker environment:

```text
REDIS_URL=redis://localhost:6379
UPTIME_SCHEDULER_INTERVAL_SECONDS=15
UPTIME_SCHEDULER_SCAN_LIMIT=100
UPTIME_WORKER_CONCURRENCY=5
```

Local Compose from `docker/` can start MySQL, Redis, and the metrics stack:

```bash
docker compose --env-file .env.example up -d mysql redis victoriametrics vmagent grafana
```

## Telemetry ingestion and query APIs (Phase 7)

Ingestion routes use API key auth:

```bash
curl -X POST http://localhost:5000/api/ingest/logs \
  -H "X-Api-Key: <api-key-with-logs-write>" \
  -H "Content-Type: application/json" \
  -d '{"level":"ERROR","message":"checkout failed","timestamp":"2026-06-16T12:00:00.000Z"}'
```

```bash
curl -X POST http://localhost:5000/api/ingest/metrics \
  -H "X-Api-Key: <api-key-with-metrics-write>" \
  -H "Content-Type: application/json" \
  -d '{"name":"checkout_latency_ms","type":"GAUGE","value":182.4,"timestamp":"2026-06-16T12:00:00.000Z"}'
```

Query routes use JWT auth and are available to active organization members, including `VIEWER`:

- `GET /api/logs`
- `GET /api/logs/:id`
- `GET /api/metrics`
- `GET /api/metrics/names`

Telemetry retention environment:

```text
LOG_RETENTION_DAYS=30
METRIC_RETENTION_DAYS=30
TELEMETRY_RETENTION_BATCH_SIZE=1000
```

Run manual retention cleanup:

```bash
npm run telemetry:cleanup
```

Known limitations:

- No VictoriaMetrics forwarding yet.
- Retention cleanup is manual/global, not per-org or scheduled.
- Log search uses simple MySQL `LIKE`; it is not full-text indexed yet.
- No long-term plan/billing quota model yet.

## Observability visualization APIs (Phase 8)

Phase 8 adds dashboard-friendly read APIs over the existing MySQL control-plane and telemetry tables.

Routes use JWT auth and are available to `VIEWER` or higher:

```text
GET /api/observability/overview
GET /api/observability/services/:serviceId/summary?range=24h&bucket=auto
GET /api/observability/retention/status
GET /api/observability/victoriametrics/health
GET /api/metrics/aggregate
GET /api/logs/stats
```

Range and bucket controls:

```text
range=1h|24h|7d|30d
bucket=auto|15s|30s|1m|5m|15m|1h|6h|1d
```

Metric aggregation supports:

```text
aggregation=avg|min|max|sum|count
groupBy=serviceId,name
```

Safety limits:

- time ranges are capped at 30 days
- time-series responses are capped at 500 buckets
- service filters must belong to the authenticated organization
- raw SQL is only used for time bucketing with Prisma parameter binding and whitelisted dynamic clauses

See `../docs/PHASE_8_NOTES.md` for the dashboard data flow and endpoint details.

## Migrations

Validate the schema:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
```

Apply migrations only after reviewing `docs/PHASE_2_NOTES.md`, `docs/PHASE_3_NOTES.md`, `docs/PHASE_4_NOTES.md`, `docs/PHASE_5_NOTES.md`, `docs/PHASE_6_NOTES.md`, and `docs/PHASE_7_NOTES.md`.

Apply pending migrations in a deployed environment with:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma migrate deploy
```

Verify required production tables:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npm run db:verify-migrations
```

Phase 7 adds `log_entries` and `metric_samples` through `backend/prisma/migrations/20260616050000_phase7_telemetry_ingestion/migration.sql`.

Phase 6 adds `incidents` and `incident_events` through `backend/prisma/migrations/20260616045000_phase6_incident_management/migration.sql`.

Before deployment, verify the chain against a real local/dev MySQL database:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma migrate status
```

See `docs/MIGRATION_CHAIN_REPAIR.md` for the Phase 6/Phase 7 migration-chain repair notes and current verification limits.

## Docker and CI

Build the backend image from the repository root:

```bash
docker build -f backend/Dockerfile backend
```

In this local environment, Docker image build currently fails during container `npm ci` with `npm error Exit handler never called!`. `npm audit --omit=dev` separately fails with `unable to verify the first certificate`, so fix the local/container Node/npm CA trust chain before claiming the image build or audit passes. Do not use an insecure permanent TLS bypass in the Dockerfile.

`docker/docker-compose.yml` can run the backend API and worker alongside MySQL, Redis, VictoriaMetrics, vmagent, and Grafana. The worker uses the same image with `npm run worker`.

GitHub Actions in `.github/workflows/ci.yml` runs lint, unit tests, Prisma validation/generation, Compose config validation, Docker build, and MySQL integration tests.

See `../docs/PRODUCTION_HARDENING.md`, `../docs/DEMO_GUIDE.md`, and `../docker/README.md`.

## Incident management (Phase 6)

Incidents represent tracked operational problems. They are separate from alerts (which are transient signals).

**Lifecycle:** OPEN -> ACKNOWLEDGED -> INVESTIGATING -> IDENTIFIED -> MONITORING -> RESOLVED -> CLOSED

**Alert-to-incident integration:** When an uptime alert rule fires, an incident is automatically created if no active incident already exists for that org/service/rule combination. When the alert recovers, a timeline event is written and the incident moves to MONITORING.

**Role permissions:**
- VIEWER: read incidents, read timeline
- DEVELOPER: create, acknowledge, assign to self, comment, resolve
- ADMIN/OWNER: assign anyone in org, close

See `docs/PHASE_6_NOTES.md` for full design documentation.

## Security notes

- Never commit `.env`, AWS credential exports, PEM/private keys, or webhook URLs.
- AWS account responses intentionally omit stored access keys and secret keys.
- Static AWS keys are still stored by the current development model; production should move to assume-role and/or encrypted secret storage.
