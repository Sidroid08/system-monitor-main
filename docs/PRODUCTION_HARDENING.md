# Production Hardening

Phase 9 adds a production-readiness foundation around the existing Sidroid backend without adding new product modules or redesigning the database.

## Scope

This phase focuses on:

- API rate limiting for auth, telemetry ingestion, and expensive read/query routes.
- Lightweight telemetry ingestion usage limits.
- Repeatable MySQL migration verification.
- Optional MySQL integration tests.
- Backend and worker container support.
- Docker Compose service wiring.
- GitHub Actions CI.
- Security and deployment documentation.

It does not add billing plans, AI incident summaries, frontend dashboards, or a new telemetry storage architecture.

## Rate Limiting

Rate limiting is implemented in `backend/src/middleware/rateLimit.js`.

Protected route groups:

- Auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- Telemetry ingestion:
  - `POST /api/ingest/logs`
  - `POST /api/ingest/metrics`
- Expensive reads:
  - `GET /api/logs`
  - `GET /api/logs/stats`
  - `GET /api/metrics`
  - `GET /api/metrics/aggregate`
  - `GET /api/observability/*`
  - `GET /api/query/*`

Rate limit keys:

- Auth uses client IP.
- Ingestion uses API key id plus organization id, with IP fallback.
- JWT read/query routes use user id plus organization id, with IP fallback.

Configuration:

```text
RATE_LIMIT_ENABLED=true
RATE_LIMIT_STORE=redis
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX=10
INGEST_RATE_LIMIT_WINDOW_SECONDS=60
INGEST_RATE_LIMIT_MAX=120
QUERY_RATE_LIMIT_WINDOW_SECONDS=60
QUERY_RATE_LIMIT_MAX=300
```

`RATE_LIMIT_STORE=memory` is acceptable for local development and unit tests. Use `RATE_LIMIT_STORE=redis` for deployed environments with multiple API replicas.

429 responses use a safe shape:

```json
{
  "success": false,
  "message": "Too many requests",
  "retryAfterSeconds": 60
}
```

The response does not expose API keys, user ids, tenant ids, Redis keys, or internal store details.

## Telemetry Usage Limits

Phase 7 already enforced a maximum raw batch size of 100 logs or metrics per request.

Phase 9 adds accepted-row request caps:

```text
TELEMETRY_MAX_ACCEPTED_LOGS_PER_REQUEST=100
TELEMETRY_MAX_ACCEPTED_METRICS_PER_REQUEST=100
```

These caps apply after payload validation. Extra valid rows are rejected inside the existing multi-status response instead of failing the entire batch.

Future SaaS plan limits should be added later as a separate product/billing phase:

- per-org rows per minute
- per-org rows per day
- storage caps
- plan-based retention windows
- usage metering for billing

## Migration Workflow

Run migration checks against disposable local/dev databases before release.

From `backend/`:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate status
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate deploy
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run db:verify-migrations
```

The verification script deploys migrations, checks migration status, and verifies these required tables:

- `incidents`
- `incident_events`
- `log_entries`
- `metric_samples`
- `uptime_alert_rules`
- `monitored_services`
- `uptime_checks`

Do not run `prisma migrate dev` against production.

## Integration Tests

Integration tests are optional and gated:

```bash
RUN_INTEGRATION_TESTS=true DATABASE_URL=mysql://... npm run test:integration
```

They are intended for disposable MySQL databases only. They verify migration deployment, required tables, telemetry insert/query behavior, raw SQL metric aggregation, log statistics, and tenant scoping.

## Demo Seed

Phase 10 adds a local demo seed command:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run seed
```

The seed creates placeholder demo users, services, uptime checks, logs, metrics, alert rules, an alert, and an incident timeline. It does not generate or print a raw API key.

## Docker Deployment Overview

The backend image is built from `backend/Dockerfile`.

The Dockerfile:

- uses Node 22 slim
- installs production dependencies only
- generates the Prisma client at build time using a placeholder URL
- copies Prisma schema, source, and scripts
- runs as the non-root `node` user
- exposes port `5000`
- defaults to `npm start`

The same image is used for the worker with a Compose command override:

```text
npm run worker
```

Migrations remain an explicit deployment step. The API and worker containers do not run destructive schema commands on startup.

## Docker Compose

`docker/docker-compose.yml` includes:

- MySQL
- Redis
- VictoriaMetrics
- vmagent
- Grafana
- backend API
- uptime worker/scheduler

Important local port variables:

```text
MYSQL_HOST_PORT=3306
BACKEND_HOST_PORT=5000
```

Use a different `MYSQL_HOST_PORT` when local MySQL is already using `3306`.

## CI Workflow

`.github/workflows/ci.yml` runs:

- backend dependency install with `npm ci`
- lint
- unit tests
- Prisma validate
- Prisma generate
- Docker Compose config validation
- backend Docker image build
- MySQL-backed integration tests in a separate job

The workflow does not require AWS credentials or production secrets.

## Secrets Handling

Do not commit:

- `.env`
- `docker/.env`
- JWT secrets
- API key peppers
- AWS credential exports
- PEM/private keys
- webhook URLs
- SMTP credentials

Use `.env.example` files for placeholders only. Production secrets should be managed by the deployment platform secret store.

## Audit Handling

Run:

```bash
npm audit --omit=dev
```

If audit fails because of local TLS or certificate trust, report the exact error. Do not claim a clean audit unless the command completes successfully.

Do not perform risky major dependency upgrades inside a hardening phase unless the vulnerability is critical and the upgrade path is validated.

## Local TLS Caveat

This development environment may fail Node/npm network calls with certificate errors such as:

```text
unable to verify the first certificate
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

That can affect `npm audit`, Prisma engine downloads, and Docker image builds that run `npm ci` inside a Linux container. Fix the local trust store or provide the required corporate/root CA to Node/npm before treating those failures as application defects.

## Remaining Production Gaps

- No plan/billing usage model.
- No per-org daily ingestion quotas.
- No reverse proxy or TLS termination in Compose.
- No production secret manager integration.
- No automated backup/restore workflow for MySQL.
- No centralized application log shipping yet.
- No frontend dashboard.
- No AI incident summaries.
- No IaC for cloud deployment.

See `docs/PRODUCTION_READINESS_CHECKLIST.md` for the recruiter-facing pass/fail checklist.
