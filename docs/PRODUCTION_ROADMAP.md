# Production Roadmap

This roadmap keeps the project moving toward a hero-level observability SaaS without rewriting everything or adding large features before the foundation is stable.

## Phase 0: Audit and planning

Status: current phase.

Tasks:

- Document the current repository architecture and gaps.
- Record existing routes, models, infrastructure, and tests.
- Add target architecture documentation.
- Add obvious hygiene ignores and documentation links only.
- Avoid feature implementation.

Do not do yet:

- Do not redesign the database.
- Do not implement AI summaries.
- Do not add a full frontend.
- Do not introduce Kubernetes or microservices.

## Phase 1: Stabilize the existing backend

Dependencies: Phase 0 audit.

Tasks:

- Add a real `npm test` script that runs only the intended test files.
- Move or rename `src/test-prisma.js` so `node --test` does not treat it as a test.
- Reconcile `backend/sql/schema.sql`, Prisma migrations, and `schema.prisma`.
- Fix stale backend README route examples.
- Fix `backend/scripts/manualSync.js` to import the current AWS sync module and use UUID IDs.
- Decide whether public `/api/org` routes are legacy; protect or remove them if not required.
- Fix `GET /api/instances` UUID handling.
- Make alert evaluator pending duration use the configured interval or an explicit duration field.
- Add backend startup instructions for local MySQL and Prisma migrations.
- Add integration tests for register, login, protected routes, and tenant-scoped data access.
- Add GitHub Actions or equivalent CI for lint, tests, and Prisma validation.

Do not do too early:

- Do not migrate from Node/Express to FastAPI unless there is a clear product or hiring reason.
- Do not switch MySQL to PostgreSQL until migrations and tests are clean.

## Phase 2: Security, tenancy, and access control

Dependencies: Phase 1 tests and schema consistency.

Tasks:

- Enforce authenticated access on all tenant data routes.
- Add route-level RBAC using existing `ADMIN`, `MEMBER`, and `VIEWER` roles.
- Add API key creation, hashing, scoping, rotation, and revocation.
- Add request rate limiting for auth and ingestion endpoints.
- Add audit logs for security-sensitive actions.
- Encrypt stored AWS credentials and notification configs, or move secrets to a secrets manager.
- Prefer AWS assume-role onboarding over static access keys.
- Add organization membership management.
- Add tenant-isolation tests that verify cross-organization access fails.

Do not do too early:

- Do not add SSO before local auth, RBAC, and API keys are reliable.
- Do not expose public ingestion endpoints before API keys and rate limits exist.

## Phase 3: Service registry and uptime checks

Dependencies: Phase 2 tenant isolation and API keys.

Tasks:

- Introduce a `Service` model separate from EC2 instances.
- Support service types such as HTTP endpoint, TCP endpoint, worker, database, EC2, container, and custom.
- Add health-check definitions per service.
- Add a worker process for uptime checks.
- Store check results with status, response time, error reason, and region/agent source.
- Add uptime and latency summary APIs.
- Add tests for check scheduling and result persistence.

Do not do too early:

- Do not build a complex global probe network before a single-region worker is stable.

## Phase 4: Metrics and logs ingestion

Dependencies: Phase 2 API keys and Phase 3 service registry.

Tasks:

- Define ingestion contracts for custom metrics and structured logs.
- Authenticate ingestion with scoped API keys.
- Add payload limits, validation, and backpressure.
- Decide storage responsibilities:
  - VictoriaMetrics for metrics.
  - A later log store such as ClickHouse, OpenSearch, Loki, or PostgreSQL JSON for early MVP volume.
- Add ingestion tests and malformed-payload tests.
- Add documentation for agents and curl examples.

Do not do too early:

- Do not build a custom metrics database.
- Do not build a full log query language in the first version.

## Phase 5: Alerts and incidents

Dependencies: Phase 3 uptime data and Phase 4 ingestion contracts.

Tasks:

- Move alert evaluation from the API process to a worker.
- Add alert policies that can target services, uptime checks, and metric queries.
- Add notification delivery retries and delivery logs.
- Add incident records with status, severity, timeline, assignee, and linked alerts.
- Add acknowledgement and resolution flows.
- Add deduplication so one noisy rule does not create endless incidents.
- Add tests for alert state transitions and incident lifecycle.

Do not do too early:

- Do not add complex on-call scheduling before basic incidents and notification reliability exist.

## Phase 6: SaaS dashboard and status pages

Dependencies: Phase 2 access control and Phase 5 incident lifecycle.

Tasks:

- Choose a frontend stack and build the authenticated SaaS app.
- Add organization switcher, service inventory, uptime views, alert rules, incidents, notification channels, and API keys UI.
- Add private dashboards for teams.
- Add public status pages with controlled visibility.
- Add frontend tests for critical flows.
- Keep Grafana as a power-user integration rather than the only UI.

Do not do too early:

- Do not make a marketing landing page before the usable product interface exists.

## Phase 7: Prometheus and Grafana integration hardening

Dependencies: Phase 3 service registry and Phase 4 metrics.

Tasks:

- Reconcile backend-generated `file_sd` targets with active vmagent config.
- Mount generated targets into vmagent when using file-based discovery.
- Add vmalert or keep backend alert evaluation, but do not run two competing sources of truth.
- Add Grafana provisioning per environment.
- Add datasource and dashboard docs for self-hosted deployments.
- Add retention, cardinality, and query-limit guidance.

Do not do too early:

- Do not expose raw VictoriaMetrics publicly without auth, network restrictions, and query controls.

## Phase 8: AI incident summaries

Dependencies: Phase 5 incidents with clean timelines and Phase 4 logs/metrics linked to services.

Tasks:

- Collect incident timeline data, alert changes, metric snapshots, deploy markers, and logs.
- Generate incident summaries after incidents resolve.
- Keep AI output as an assistant draft, not an automatic source of truth.
- Add redaction for secrets and customer-sensitive logs.
- Store prompt input metadata for auditability.
- Add tests around redaction and summary persistence.

Do not do too early:

- Do not add AI before incidents, logs, metrics, and access control are reliable.

## Phase 9: Production operations

Dependencies: Phases 1 through 7.

Tasks:

- Add Dockerfile for backend and include backend, database, Redis, and monitoring services in local Compose.
- Add CI/CD with tests, migrations, image build, and deployment gates.
- Add structured logs, request IDs, metrics, and tracing for the SaaS backend itself.
- Add backups and restore drills for the database.
- Add secret management and environment separation.
- Add TLS/reverse proxy configuration.
- Add dependency scanning and container scanning.
- Add runbooks for incidents, migrations, rollbacks, and credential rotation.

## Recommended next phase

The repo is ready for Phase 1 stabilization, not feature expansion. The highest-value next work is to make the current backend testable, reconcile database documentation/migrations, protect tenant routes, and remove stale scripts/docs before adding uptime workers, ingestion, or AI.
