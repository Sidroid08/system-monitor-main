# Sidroid Monitoring System

A production-style multi-tenant observability SaaS for monitoring services, uptime, logs, metrics, alerts, incidents, and dashboards.

Sidroid started as an infrastructure monitoring stack and has been expanded into a production-grade foundation for a backend observability platform. It is built to demonstrate SaaS architecture, tenant isolation, background workers, telemetry ingestion, incident management, and deployment discipline without pretending to be a finished commercial product.

## Why This Project Exists

Modern engineering teams need more than raw metrics. They need a control plane where teams can register services, collect telemetry, evaluate health, alert the right people, and track incidents through resolution. Sidroid models that full backend workflow in a focused portfolio project:

- teams and organizations can be isolated as tenants,
- services can be monitored manually or by workers,
- logs and metrics can be ingested through scoped API keys,
- alerts can create incidents,
- dashboards can query summary APIs,
- production hardening is documented honestly.

## Key Features

### Multi-Tenant SaaS Foundation

- Organizations and organization memberships.
- JWT authentication with bcrypt password hashing.
- Role-based access control for `OWNER`, `ADMIN`, `DEVELOPER`, and `VIEWER`.
- Organization-scoped API keys with hashed storage and one-time raw key return.
- Tenant isolation tests for protected routes and data access paths.
- Audit logging for sensitive actions.

### Service Monitoring

- Organization-scoped monitored service registry.
- HTTP/API/WEB health check definitions.
- Manual uptime checks with status, response time, status code, and error storage.
- Service status tracking with consecutive success/failure counters.
- SSRF-aware URL validation and safe health-check behavior.

### Scheduled Workers

- Redis/BullMQ queue foundation.
- Scheduled uptime worker and scheduler.
- Worker diagnostics endpoint.
- Worker process can run separately from the API process.
- Docker Compose support for API and worker containers.

### Alerts And Notifications

- Uptime alert rules for service down, degraded, response-time, and consecutive-failure signals.
- Cooldown and deduplication behavior.
- Notification channel model for email, Slack, and webhook-style delivery.
- Alert lifecycle from open to acknowledged/resolved.

### Incident Management

- Incident lifecycle: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `IDENTIFIED`, `MONITORING`, `RESOLVED`, `CLOSED`.
- Assignment, comments, timeline events, and postmortem fields.
- Alert-to-incident integration.
- RBAC-aware incident actions.
- Tenant-scoped incident queries.

### Logs And Metrics Ingestion

- API-key-authenticated log ingestion.
- API-key-authenticated metric ingestion.
- Request-level ingestion caps and rate limits.
- Sensitive telemetry attribute redaction.
- Cursor pagination for log and metric query APIs.
- Manual retention cleanup command.

### Dashboard And Observability APIs

- Overview API for service, alert, incident, uptime, log, and metric summaries.
- Service summary API.
- Metric aggregation API.
- Log statistics API.
- VictoriaMetrics health endpoint.
- VictoriaMetrics query route hardening.

### Security And Production Hardening

- Helmet, CORS configuration, request size limits, and safe error handling.
- Rate limiting for auth, ingestion, and expensive read/query routes.
- Redis-backed rate limiter option with memory fallback.
- Prisma migration verification script.
- MySQL integration tests.
- GitHub Actions CI.
- Backend Dockerfile and Docker Compose wiring.
- Honest production-readiness checklist.

## Tech Stack

| Area | Technology |
|---|---|
| Backend | Node.js, Express 5, ES modules |
| Database | MySQL, Prisma 5 |
| Auth | JWT, bcrypt |
| Validation | Zod |
| Workers | Redis, BullMQ |
| Metrics stack | VictoriaMetrics, vmagent, Grafana, node_exporter |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Testing | Node test runner, unit tests, MySQL integration tests |
| Security | Helmet, RBAC, API key hashing, rate limiting, tenant scoping |

## Architecture

```mermaid
flowchart LR
  Client[API Client or SaaS UI] --> API[Express API]
  API --> Auth[JWT Auth and RBAC]
  API --> MySQL[(MySQL via Prisma)]
  API --> Redis[(Redis)]
  API --> VM[VictoriaMetrics Query API]

  Ingest[Telemetry Producers] --> ApiKey[Scoped API Keys]
  ApiKey --> API

  Scheduler[Uptime Scheduler] --> Redis
  Redis --> Worker[Uptime Worker]
  Worker --> Targets[Customer Services]
  Worker --> MySQL

  MySQL --> Alerts[Alert Evaluation]
  Alerts --> Incidents[Incident Timeline]
  VM --> Grafana[Grafana Dashboards]
```

Sidroid separates the control plane from the monitoring data plane:

- Control plane: organizations, users, API keys, services, alerts, incidents, audit logs, and dashboard APIs.
- Data plane: uptime checks, ingested logs, custom metrics, VictoriaMetrics scrape/query data, and worker execution.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a deeper architecture walkthrough.

## Data Flows

### Uptime Check Flow

```mermaid
sequenceDiagram
  participant S as Scheduler
  participant Q as Redis/BullMQ
  participant W as Worker
  participant T as Service URL
  participant DB as MySQL
  participant A as Alert Logic

  S->>DB: Find due services
  S->>Q: Enqueue uptime check
  W->>Q: Consume job
  W->>T: Perform safe HTTP check
  W->>DB: Store uptime result
  W->>A: Evaluate uptime rules
  A->>DB: Create/update alert and incident events
```

### Telemetry Ingestion Flow

```mermaid
sequenceDiagram
  participant C as Service/Agent
  participant API as Express API
  participant K as API Key Auth
  participant L as Rate/Quota Limits
  participant DB as MySQL

  C->>API: POST /api/ingest/logs or /metrics
  API->>K: Validate hashed scoped API key
  API->>L: Apply API-key/org rate limits
  API->>API: Validate, redact, and cap accepted rows
  API->>DB: Insert log entries or metric samples
  API-->>C: 207 accepted/rejected summary
```

### Alert-To-Incident Flow

```mermaid
flowchart TD
  Signal[Uptime or metric signal] --> Rule[Alert rule evaluation]
  Rule -->|condition true| Alert[Open alert]
  Alert --> Dedupe{Active incident exists?}
  Dedupe -->|no| Incident[Create incident]
  Dedupe -->|yes| Timeline[Append timeline event]
  Incident --> Timeline
  Timeline --> Resolve[Recover, resolve, close]
```

## Repository Structure

```text
monitoring-system/
  backend/                 Express/Prisma SaaS control-plane backend
  configs/                 vmagent and Prometheus scrape examples
  dashboards/              Grafana dashboard JSON
  docker/                  Docker Compose stack and Grafana provisioning
  docs/                    Architecture, API, demo, security, roadmap docs
  scripts/                 Linux/node_exporter helper scripts
  aws/                     EC2 setup notes
```

## Local Setup Quickstart

Prerequisites:

- Node.js 22+
- Docker Desktop
- MySQL available through Docker Compose or a local/dev database
- Redis for worker/scheduler flows

Install backend dependencies:

```bash
cd backend
npm install
cp .env.example .env
```

Start local infrastructure:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d mysql redis victoriametrics vmagent grafana
```

If port `3306` is already taken:

```powershell
$env:MYSQL_HOST_PORT="3308"
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d mysql redis
```

Apply migrations:

```bash
cd backend
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate status
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate deploy
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run db:verify-migrations
```

Seed local demo data:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run seed
```

Start the API:

```bash
npm run dev
```

Start the worker in another terminal:

```bash
npm run worker
```

## Docker Compose Setup

Render and validate Compose config:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example config
```

Start the local stack:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d
```

The backend image is defined in `backend/Dockerfile`. In this local environment, `docker build -f backend/Dockerfile backend` currently fails during container `npm ci` with `npm error Exit handler never called!`. `npm audit --omit=dev` separately fails with `unable to verify the first certificate`, so the local/container Node/npm CA trust chain should be fixed before claiming Docker build or audit success.

## Testing

From `backend/`:

```bash
npm run lint
npm test
```

Optional MySQL integration tests:

```bash
RUN_INTEGRATION_TESTS=true DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run test:integration
```

Prisma checks:

```bash
DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/placeholder npx prisma validate
DATABASE_URL=mysql://placeholder:placeholder@127.0.0.1:3306/placeholder npx prisma generate
```

Audit attempt:

```bash
npm audit --omit=dev
```

Audit currently fails in this local environment with `unable to verify the first certificate`. A clean audit should not be claimed until that command succeeds.

## API Overview

| Area | Routes |
|---|---|
| Health | `GET /health`, `GET /health/ready` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Organizations | `GET /api/org`, `GET /api/org/:id` |
| API keys | `GET /api/api-keys`, `POST /api/api-keys`, revoke/delete routes |
| Services | `GET/POST /api/services`, `GET/PATCH/DELETE /api/services/:id`, `POST /api/services/:id/check` |
| Uptime alert rules | `GET/POST /api/uptime-alert-rules` |
| Alerts | `GET /api/alerts`, `PATCH /api/alerts/:id` |
| Incidents | `GET/POST /api/incidents`, action routes, timeline route |
| Ingestion | `POST /api/ingest/logs`, `POST /api/ingest/metrics` |
| Logs | `GET /api/logs`, `GET /api/logs/stats`, `GET /api/logs/:id` |
| Metrics | `GET /api/metrics`, `GET /api/metrics/names`, `GET /api/metrics/aggregate` |
| Observability | `GET /api/observability/overview`, service summary, retention status, VM health |
| VictoriaMetrics proxy | `GET/POST /api/query/instant`, `GET/POST /api/query/range`, `GET /api/query/labels` |

See [docs/API_EXAMPLES.md](docs/API_EXAMPLES.md) for copy-paste curl examples.

## Example API Calls

Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Siddhant","email":"siddhant@example.com","password":"DemoPass123!","organizationName":"Acme Observability"}'
```

Create a monitored service:

```bash
curl -X POST http://localhost:5000/api/services \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Checkout API","type":"API","environment":"production","url":"https://example.com/health","healthPath":"/health","intervalSeconds":60}'
```

Ingest logs:

```bash
curl -X POST http://localhost:5000/api/ingest/logs \
  -H "X-Api-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"level":"ERROR","message":"checkout dependency timeout","serviceId":"<SERVICE_ID>"}]}'
```

Get dashboard overview:

```bash
curl http://localhost:5000/api/observability/overview \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Demo Workflow

1. Start MySQL and Redis with Docker Compose.
2. Run Prisma migrations.
3. Run `npm run seed` to create local demo data.
4. Start the API with `npm run dev`.
5. Log in as a seeded demo user.
6. Create a disposable API key with `logs:write` and `metrics:write`.
7. Register or inspect monitored services.
8. Trigger a manual uptime check.
9. Ingest demo logs and metrics.
10. Query overview, service summary, log stats, metric aggregation, alerts, and incidents.

Full walkthrough: [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md).

## Production-Readiness Checklist

Passed or implemented as a production-grade foundation:

- Tenant isolation and RBAC.
- JWT auth and hashed API keys.
- Scheduled workers with Redis/BullMQ.
- Uptime checks, alerts, incidents, telemetry ingestion.
- Rate limiting and request-level telemetry caps.
- Prisma migration chain verification.
- MySQL integration tests.
- CI workflow.
- Docker/Compose foundation.

Needs work before real production:

- `npm audit --omit=dev` must pass.
- Docker image build must pass without local TLS workaround.
- Managed secrets and environment-specific config.
- TLS/reverse proxy.
- Database backups and restore runbooks.
- App self-monitoring and log shipping.
- Persistent per-org quotas/billing.
- Full frontend and session handling.
- Cloud deployment/IaC.

Detailed checklist: [docs/PRODUCTION_READINESS_CHECKLIST.md](docs/PRODUCTION_READINESS_CHECKLIST.md).

## Known Limitations

- No frontend application yet.
- No AI incident summaries yet.
- No billing or plan enforcement.
- Logs and custom metrics are MySQL-backed; VictoriaMetrics forwarding for custom metrics is future work.
- Docker build fails locally during container `npm ci`, while npm audit fails locally with certificate verification.
- Docker Compose is a local/demo deployment model, not a complete production orchestrator.
- Existing `backend/prisma/seed.js` is left untouched; use `npm run seed` for the Phase 10 demo seed.

## Roadmap

- Final code quality and README accuracy review.
- Resume/LinkedIn packaging.
- Fix local/container CA trust and complete Docker build + audit.
- Add demo screenshots or short walkthrough video.
- Add frontend dashboard.
- Add scheduled telemetry retention worker.
- Add persistent usage quotas and billing model.
- Add production reverse proxy/TLS and managed secret integration.
- Add cloud deployment/IaC.
- Add AI incident summaries after the core product is stable.

## Resume Bullets

- Built a production-style multi-tenant observability SaaS backend with Node.js, Express, Prisma, MySQL, Redis/BullMQ, and Docker Compose.
- Implemented tenant-scoped authentication, RBAC, hashed API keys, audit logging, service monitoring, alerts, incidents, and telemetry ingestion.
- Designed uptime worker architecture using Redis/BullMQ with scheduled checks, alert deduplication, cooldowns, and incident timeline integration.
- Added dashboard-ready observability APIs for overview data, service summaries, log statistics, metric aggregation, and VictoriaMetrics health.
- Hardened the backend with rate limiting, integration tests, migration verification, CI, Docker support, and production-readiness documentation.

More resume assets: [docs/RESUME_BULLETS.md](docs/RESUME_BULLETS.md).

## Interview Explanation

Sidroid is best described as a production-grade foundation for an observability SaaS. The important engineering story is not just the endpoints, but the architecture: tenant isolation, scoped API keys, background workers, telemetry ingestion limits, alert-to-incident workflows, migration verification, CI, and honest deployment constraints. It demonstrates how to evolve a monitoring stack into a SaaS control plane in safe phases.

Interview notes: [docs/INTERVIEW_NOTES.md](docs/INTERVIEW_NOTES.md).

## Screenshots And Demo Media

No frontend screenshots are included yet. Suggested screenshots and demo flow are documented in [docs/SCREENSHOTS.md](docs/SCREENSHOTS.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API examples](docs/API_EXAMPLES.md)
- [Demo guide](docs/DEMO_GUIDE.md)
- [Project summary](docs/PROJECT_SUMMARY.md)
- [Interview notes](docs/INTERVIEW_NOTES.md)
- [Resume bullets](docs/RESUME_BULLETS.md)
- [Screenshots guide](docs/SCREENSHOTS.md)
- [Production readiness checklist](docs/PRODUCTION_READINESS_CHECKLIST.md)
- [Production hardening](docs/PRODUCTION_HARDENING.md)
- [Production roadmap](docs/PRODUCTION_ROADMAP.md)
- [Target architecture](docs/TARGET_ARCHITECTURE.md)

## License

No license file is currently present. Add a license before promoting the project for reuse outside a portfolio/recruiter context.
