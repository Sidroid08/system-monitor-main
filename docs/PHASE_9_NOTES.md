# Phase 9 - Production Hardening Foundation

## What Existed Before Phase 9

The backend already had:

- JWT authentication and organization membership checks.
- API-key authenticated telemetry ingestion.
- RBAC-protected logs, metrics, observability, and VictoriaMetrics query APIs.
- Redis/BullMQ uptime worker support.
- Docker Compose infrastructure services for MySQL, Redis, VictoriaMetrics, vmagent, and Grafana.
- Phase 6 and Phase 7 migrations verified against fresh Docker MySQL.
- Phase 8 dashboard-friendly read APIs.

Production-readiness gaps remained:

- no API rate limiting
- no request-level telemetry ingestion quotas beyond batch size
- no backend Dockerfile
- no Compose backend/worker services
- no GitHub Actions CI
- no repeatable integration-test/migration-verification command
- no production hardening deployment guide

## Rate Limiting

Phase 9 adds `backend/src/middleware/rateLimit.js`.

Protected route groups:

- auth:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
- ingestion:
  - `POST /api/ingest/logs`
  - `POST /api/ingest/metrics`
- expensive dashboard/query reads:
  - `GET /api/logs`
  - `GET /api/logs/stats`
  - `GET /api/metrics`
  - `GET /api/metrics/aggregate`
  - `GET /api/observability/*`
  - `/api/query/*`

Rate-limit keys:

- auth: client IP
- ingestion: API key id + organization id, fallback client IP
- query/dashboard: user id + organization id, fallback client IP

Store behavior:

- `RATE_LIMIT_STORE=memory` uses an in-process memory bucket.
- `RATE_LIMIT_STORE=redis` uses existing `ioredis` and `REDIS_URL`.
- If Redis is configured but unavailable, the middleware falls back to memory to avoid returning 500s.

429 response shape:

```json
{
  "success": false,
  "message": "Too many requests",
  "retryAfterSeconds": 60
}
```

No internal store details, keys, API keys, or user identifiers are returned.

## Rate Limit Environment Variables

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

`RATE_LIMIT_ENABLED` defaults to disabled in `NODE_ENV=test` and enabled elsewhere.

## Telemetry Usage Limits

Phase 7 already capped raw batch size at 100 items.

Phase 9 adds accepted-row caps after validation and tenant service ownership checks:

```text
TELEMETRY_MAX_ACCEPTED_LOGS_PER_REQUEST=100
TELEMETRY_MAX_ACCEPTED_METRICS_PER_REQUEST=100
```

If a request exceeds the accepted quota, extra valid rows are rejected within the existing multi-status response instead of failing the entire batch.

Future SaaS plan quotas should add:

- per-org rows/minute and rows/day
- per-plan retention windows
- per-org storage caps
- billing-safe usage counters

No billing model or schema change was added in Phase 9.

## Integration And Migration Testing

New scripts:

```text
npm run test:unit
npm run test:integration
npm run db:verify-migrations
```

Integration tests are gated:

```text
RUN_INTEGRATION_TESTS=true
DATABASE_URL=mysql://...
```

Integration coverage:

- migration deploy against MySQL
- required table verification:
  - `incidents`
  - `incident_events`
  - `log_entries`
  - `metric_samples`
  - `uptime_alert_rules`
  - `monitored_services`
  - `uptime_checks`
- telemetry insert/query tenant scoping
- MySQL-backed metric aggregation raw SQL
- MySQL-backed log stats raw SQL
- observability overview query path

The tests are designed for disposable local or CI MySQL databases only.

## Dockerization

Added:

- `backend/Dockerfile`
- `backend/.dockerignore`

The Dockerfile:

- uses Node 22 slim
- installs production dependencies only
- generates Prisma client during build with a build-time dummy URL
- does not bake runtime secrets into the image
- runs as the non-root `node` user
- exposes port `5000`
- defaults to `npm start`

The same image can run the worker via Compose command override:

```text
npm run worker
```

## Docker Compose

`docker/docker-compose.yml` now includes:

- `backend`
- `worker`
- `mysql`
- `redis`
- `victoriametrics`
- `vmagent`
- `grafana`

MySQL host port is configurable:

```text
MYSQL_HOST_PORT=3306
```

Backend host port is configurable:

```text
BACKEND_HOST_PORT=5000
```

The backend waits for healthy MySQL/Redis and started VictoriaMetrics. The worker waits for healthy MySQL/Redis and runs independently from the API process.

Migration deployment is intentionally separate:

```bash
cd backend
DATABASE_URL=mysql://... npx prisma migrate status
DATABASE_URL=mysql://... npx prisma migrate deploy
DATABASE_URL=mysql://... npm run db:verify-migrations
```

## CI/CD

Added:

```text
.github/workflows/ci.yml
```

Jobs:

- backend unit validation:
  - `npm ci`
  - `npm run lint`
  - `npm test`
  - `npx prisma validate`
  - `npx prisma generate`
  - Docker Compose config validation
  - backend Docker image build
- MySQL integration:
  - MySQL 8.4 service
  - `npm ci`
  - `npx prisma generate`
  - `npm run test:integration`

CI does not require AWS credentials or production secrets.

## Security Notes

- Do not commit `.env` or `docker/.env`.
- Rotate `JWT_SECRET` and `API_KEY_PEPPER` outside local development.
- Use `RATE_LIMIT_STORE=redis` in deployed environments with multiple API replicas.
- Run migrations as an explicit release step.
- Do not run `prisma migrate dev` against production.
- Keep Grafana admin credentials out of committed files for production.

## Validation Results

Commands run in Phase 9:

| Command | Result | Notes |
|---|---|---|
| `npm run lint` | Pass | `node --check src/server.js` completed successfully. |
| `npm test` | Pass | 297 unit tests passed. |
| `npx prisma migrate status` against fresh Docker MySQL before deploy | Expected non-zero | Fresh database reported 8 pending migrations. |
| `npx prisma migrate deploy` against fresh Docker MySQL | Pass | All 8 migrations applied. |
| `npx prisma migrate status` after deploy | Pass | Database schema reported up to date. |
| `npm run db:verify-migrations` | Pass | Required tables verified. |
| `npm run test:integration` | Pass | 3 MySQL integration tests passed with `RUN_INTEGRATION_TESTS=true`. |
| `npx prisma validate` | Pass | Schema validated with a placeholder `DATABASE_URL`. |
| `npx prisma generate` | Pass | Prisma client generated successfully when run after tests completed. |
| `docker compose -f docker/docker-compose.yml --env-file docker/.env.example config` | Pass | Compose config rendered successfully. |
| `docker build -f backend/Dockerfile backend` | Fail in this local environment | Container npm install failed because registry TLS verification failed with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; npm surfaced it as `Exit handler never called!`. This appears environment/certificate related, not an application Dockerfile syntax error. |
| `npm audit --omit=dev` | Fail in this local environment | Audit request failed with `unable to verify the first certificate`; no clean audit can be claimed. |

During local remediation, Prisma engines were refreshed once with a process-local TLS bypass because this machine could not verify `binaries.prisma.sh`. The required Prisma commands were rerun normally afterward from the restored local cache.

## Known Limitations

- In-memory rate limiting is per-process and not suitable for multi-replica production.
- Redis rate limiter fallback to memory preserves availability but weakens global limits during Redis outage.
- No long-term usage/billing model exists yet.
- No per-plan quota model exists yet.
- Docker Compose is still local/development oriented and not a full production orchestrator.
- No reverse proxy/TLS container is included.
- `npm audit` and local Docker image builds can fail in this environment because Node/npm cannot verify the local registry certificate chain.

## Phase 10 Recommendation

Phase 10 should focus on recruiter/demo readiness:

- final README polish
- demo seed data
- architecture diagrams
- screenshots or demo script
- final deployment walkthrough
- concise recruiter-facing project narrative

Phase 10 should keep the Docker `npm ci` failure and `npm audit` certificate limitation visible until the local/container CA trust chain is fixed.
