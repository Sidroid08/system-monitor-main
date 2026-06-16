# Repository Audit

Phase 0 audit for turning the current monitoring project into a production-grade multi-tenant observability SaaS.

## Current repo summary

This repository currently contains two related parts:

1. A monitoring data plane built around Docker Compose, VictoriaMetrics, vmagent, Grafana, node_exporter, and shell scripts.
2. A Node.js/Express control-plane backend under `backend/` for organizations, users, AWS account records, EC2 discovery, alert rules, notification channels, and VictoriaMetrics queries.

There is no frontend application in the repository. Grafana is the current UI for metrics dashboards.

## Folder structure

- `backend/`: Express API, Prisma schema, migrations, seed script, and Node test files.
- `configs/`: vmagent and Prometheus scrape examples.
- `dashboards/`: provisioned Grafana dashboard JSON.
- `docker/`: Docker Compose stack for VictoriaMetrics, vmagent, and Grafana.
- `docs/`: existing setup, architecture, troubleshooting, and Grafana documentation.
- `aws/`: EC2 setup notes.
- `scripts/`: host-level monitoring setup and push-metrics shell scripts.

## Main tech stack detected

- Backend runtime: Node.js with ES modules.
- Backend framework: Express 5.
- Database ORM: Prisma 5.
- Database configured by Prisma: MySQL.
- Authentication: JWT login/register flow with bcrypt password hashing.
- Monitoring storage/query: VictoriaMetrics.
- Scraping: vmagent plus node_exporter.
- Dashboarding: Grafana.
- Validation: Zod.
- Tests: Node built-in test runner.
- Containers: Docker Compose for monitoring services only.

The requested future stack mentioned Python/FastAPI and PostgreSQL as options. The current implementation is already Node/Express and MySQL/Prisma, so a safe SaaS roadmap should stabilize this stack first instead of rewriting it.

## Current architecture

```text
Users / API clients
        |
        v
Express backend (backend/src)
        |
        +--> Prisma --> MySQL
        |
        +--> AWS SDK --> AWS EC2 discovery
        |
        +--> VictoriaMetrics query API
        |
        +--> file_sd target writer (configs/targets)

node_exporter targets --> vmagent --> VictoriaMetrics --> Grafana dashboards
```

The backend acts as an early control plane. The Docker Compose monitoring stack acts as the metrics data plane.

## Existing API routes

- `GET /health`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/org`
- `GET /api/org`
- `GET /api/org/:id`
- `POST /api/aws`
- `GET /api/aws`
- `POST /api/aws/:id/sync`
- `GET /api/instances`
- `GET /api/alert-rules`
- `POST /api/alert-rules`
- `GET /api/alert-rules/:id`
- `PATCH /api/alert-rules/:id`
- `DELETE /api/alert-rules/:id`
- `GET /api/notification-channels`
- `POST /api/notification-channels`
- `GET /api/notification-channels/:id`
- `PATCH /api/notification-channels/:id`
- `DELETE /api/notification-channels/:id`
- `POST /api/notification-channels/:id/test`
- `GET /api/query/instant`
- `POST /api/query/instant`
- `GET /api/query/range`
- `POST /api/query/range`
- `GET /api/query/labels`

Most operational routes are protected by JWT auth. The organization routes are currently public.

## Existing models and schemas

The current Prisma schema defines:

- `Organization`
- `User`
- `AwsAccount`
- `MonitoredInstance`
- `ApiKey`
- `AlertRule`
- `Alert`
- `NotificationChannel`
- `SyncLog`

Important model observations:

- Organizations and users already support basic tenant separation through `organizationId`.
- User roles exist as `ADMIN`, `MEMBER`, and `VIEWER`, but route-level RBAC is not implemented.
- `ApiKey` exists in the data model, but no API key management or API-key authentication routes exist yet.
- Alerting models exist, including alert rules and generated alerts.
- Notification channels exist, but channel config is stored as JSON text and is not encrypted.

## Existing monitoring functionality

Current working monitoring pieces:

- Docker Compose starts VictoriaMetrics, vmagent, and Grafana.
- Grafana is provisioned with a VictoriaMetrics datasource and dashboard.
- `configs/vmagent_config.yml` supports VictoriaMetrics self-scrape, vmagent self-scrape, and AWS EC2 service discovery.
- `scripts/install_node_exporter.sh` installs node_exporter on Linux hosts.
- `scripts/send_metrics.sh` can push labeled node_exporter metrics to VictoriaMetrics.
- The backend can query VictoriaMetrics with an `extra_label` tenant filter.
- The backend has an alert rule evaluator that queries VictoriaMetrics and creates alerts.

Important gap:

- `targetWriter.js` writes Prometheus `file_sd` JSON into `configs/targets`, but the current vmagent config does not read `configs/targets`, and Docker Compose does not mount that directory into vmagent. That makes the generated target files disconnected from the active scrape configuration.

## Current strengths

- Good initial separation between control plane (`backend/`) and metrics stack (`docker/`, `configs/`, `dashboards/`).
- Prisma schema already has a useful SaaS-oriented domain model.
- JWT registration creates an organization and initial admin in a transaction.
- Zod validation exists on several request bodies.
- Tenant-scoped VictoriaMetrics queries use `extra_label`, which is safer than ad hoc PromQL string rewriting.
- Basic liveness and readiness endpoints exist.
- Docker Compose can parse the monitoring stack.
- Some focused tests exist for authentication middleware, schemas, protected routes, and evaluator condition logic.
- `.env.example` exists for the backend.

## Current weaknesses

- No frontend application exists outside Grafana.
- Backend README is stale in places and describes older integer-ID routes and raw SQL flows.
- There are two database histories: `backend/sql/schema.sql` uses older integer IDs, while Prisma uses UUID strings.
- The Prisma migration history does not obviously cover every model currently present in `schema.prisma`.
- `backend/scripts/manualSync.js` imports `../src/services/awsSyncService.js`, but that path does not exist.
- `src/middleware/error.middleware.js` appears to be an unused older error handler beside the active `errorHandler.js`.
- `src/utils/jwt.js` duplicates token-signing behavior but is not used by the auth controller.
- `src/utils/orgCode.js` appears to belong to an older organization-code model and is not used by the current Prisma schema.
- The organization create route is public and does not match the current Prisma model well.
- `GET /api/instances` parses `orgId` as a number even though `organizationId` is a UUID string.
- AWS sync runs inside the API request path instead of through a background worker.
- Notification channel test dispatches through the global dispatcher, which loads all active channels for the organization instead of testing only the selected channel.
- Alert evaluator timing assumes 30-second cycles when calculating pending cycles, even though the interval is configurable.

## Production gaps

- No production-grade frontend, customer dashboard, or admin console.
- No full service registry beyond AWS EC2 instances.
- No generic uptime checks yet.
- No logs ingestion or log search.
- No metrics ingestion API for customer agents.
- No incident management workflows beyond raw alerts.
- No status page model or public/private dashboard separation.
- No Redis queue or worker process.
- No CI pipeline.
- No migration/deployment runbook for backend + database.
- No container definition for the backend.
- No environment-specific configuration strategy.
- No rate limiting, request IDs, structured logging, or audit logs.
- No OpenAPI contract.
- No backup, retention, or disaster recovery plan.

## Security gaps

- AWS static credentials are supported and stored directly on `AwsAccount`; production should prefer assume-role and encrypt any stored secrets.
- Notification channel config can contain webhook URLs and is stored as plain JSON text.
- Local `docker/.env` exists and contains AWS environment keys. Keep it ignored and rotate values if they were ever committed or shared.
- Git status shows deleted credential/key files that existed before this audit (`*.csv` credential exports and a PEM key). Treat any previously committed credentials as exposed and rotate them.
- Grafana uses default-style admin credentials in Compose and exposes the service on a host port.
- VictoriaMetrics and vmagent are exposed on host ports in Compose.
- No rate limiting or brute-force protection on auth endpoints.
- No refresh-token/session invalidation strategy.
- No route-level RBAC enforcement.
- Public organization routes need protection or removal after the registration flow is finalized.
- CORS defaults are permissive outside production.

## Testing gaps

- `package.json` does not define a `test` script.
- `node --test` without explicit files also executes `src/test-prisma.js`, which is a connectivity script, not a test, and fails without `DATABASE_URL`.
- No integration tests cover registration/login against a real or test database.
- No tests cover AWS sync behavior, target writing, alert persistence, notification delivery, RBAC, API keys, or tenant isolation failures.
- No contract tests for API response shapes.
- No CI test matrix.
- No Docker Compose smoke test.

## Deployment gaps

- Docker Compose currently deploys only VictoriaMetrics, vmagent, and Grafana.
- Backend has no Dockerfile and is not part of Compose.
- Database is not part of the local Compose stack.
- Redis/queue infrastructure is absent.
- No reverse proxy or TLS configuration.
- No production secret management.
- No health-check wiring for containers.
- No IaC or repeatable cloud deployment path.

## Commands run during audit

| Command | Status | Notes |
| --- | --- | --- |
| `git status --short --branch` | Failed first, then passed with `safe.directory` | Git initially rejected the repo due to dubious ownership. Per-command `safe.directory` was used. Existing dirty state included deleted credential/key files, `.claude/`, and untracked `.gitignore`. |
| `npm run lint` in `backend/` | Passed | Runs `node --check src/server.js`. |
| `node --test` in `backend/` | Failed | Node also executed `src/test-prisma.js`, which requires `DATABASE_URL`. |
| `node --test test\authenticate.test.js test\protected-routes.test.js test\schemas.test.js test\evaluator.test.js` | Passed | 22 tests passed. The app logs an expected Zod validation error during one protected-route test. |
| `npx prisma validate` | Failed first, then passed with `DATABASE_URL` set | Prisma validation requires `DATABASE_URL`; with a dummy local MySQL URL, schema validation passed. |
| `docker compose config` in `docker/` | Passed with warnings | Compose parsed. Docker warned it could not read the user Docker config. The expanded config included local AWS env values from `docker/.env`; values are not repeated here. |

## Phase 0 recommendation

Do not rewrite the backend yet. The project already contains enough SaaS/control-plane shape to evolve safely. Phase 1 should stabilize the current Node/Express/Prisma/MySQL codebase, fix stale docs/scripts, protect tenant boundaries, and introduce reliable test and deployment foundations before adding new product features.
