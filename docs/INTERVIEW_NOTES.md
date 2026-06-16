# Interview Notes

## 60-Second Explanation

Sidroid is a production-style multi-tenant observability SaaS backend. It lets teams register services, run uptime checks, ingest logs and metrics through scoped API keys, create alert rules, manage incidents, and query dashboard-ready overview APIs. I built it in phases to show how a monitoring stack can become a SaaS control plane with tenant isolation, RBAC, workers, rate limiting, MySQL integration tests, Docker Compose, and CI.

## 2-Minute Deep Explanation

The system is split into a SaaS control plane and monitoring data flows. The control plane handles organizations, users, memberships, RBAC, API keys, service definitions, alerts, incidents, audit logs, and dashboards. The data plane handles uptime checks through Redis/BullMQ workers, logs and custom metrics through API-key ingestion, and infrastructure metrics through VictoriaMetrics/Grafana.

The most important backend decisions are tenant scoping and safe operational workflows. User requests derive tenant scope from JWT membership. Ingestion derives tenant scope from the API key, so clients cannot spoof `organizationId`. Workers store uptime results, alert logic applies deduplication and cooldowns, and alert transitions can create incident timeline events. Phase 9 added rate limiting, migration verification, integration tests, Docker support, and CI. Phase 10 packages the project for recruiter and interview review while preserving honest limitations.

## Architecture Explanation

Use this structure:

1. API layer: Express routes, Zod validation, auth middleware, RBAC middleware.
2. Persistence: Prisma with MySQL and tenant-scoped models.
3. Background work: Redis/BullMQ scheduler and worker.
4. Observability data: uptime checks, log entries, metric samples, VictoriaMetrics.
5. Operational workflow: alert rules -> alerts -> incidents -> timeline.
6. Deployment foundation: Docker Compose, backend Dockerfile, CI.

## Hardest Engineering Problems Solved

- Maintaining tenant isolation across JWT routes, API-key routes, repositories, and tests.
- Designing API keys so the raw secret is never stored and the organization scope comes from the key.
- Separating API request handling from scheduled uptime workers.
- Handling alert deduplication, cooldowns, and alert-to-incident integration.
- Adding real MySQL integration tests for raw SQL aggregation paths.
- Keeping migrations verifiable against disposable databases.
- Documenting production gaps honestly after Docker build failed during container `npm ci` and audit failed on local certificate verification.

## Security Decisions

- bcrypt password hashing.
- JWT-based user auth.
- Hashed API keys with one-time raw key return.
- RBAC per organization membership.
- Tenant scoping in route/controller/repository paths.
- Sensitive telemetry attribute redaction.
- Request size limits.
- Rate limiting for auth, ingestion, and expensive queries.
- No real secrets committed.

## Scaling Decisions

- Redis/BullMQ separates workers from API.
- Cursor pagination avoids offset-only telemetry pagination.
- MySQL indexes support tenant/time query paths.
- Redis-backed rate limiting can work across multiple API replicas.
- Docker Compose separates API, worker, Redis, MySQL, VictoriaMetrics, and Grafana.

## Tradeoffs

- Logs and custom metrics are currently stored in MySQL for simpler demo and query behavior; high-volume production telemetry should move to purpose-built storage.
- Compose is used for local/demo orchestration, not full production deployment.
- Billing and persistent quota models are deferred.
- The API is backend-only; no polished frontend exists yet.
- AI incident summaries are intentionally deferred until the core SaaS workflow is stable.

## What Is Not Production-Ready Yet

- Docker build must pass in the target environment without TLS workarounds.
- `npm audit --omit=dev` must complete successfully.
- Managed secrets are required.
- TLS/reverse proxy is required.
- Backups and restore drills are missing.
- App self-monitoring and centralized log shipping are missing.
- Full frontend auth/session handling is missing.
- Cloud deployment/IaC is missing.

## Likely Interview Questions

### How do you prevent tenant data leaks?

JWT routes use the authenticated membership organization. API-key ingestion uses the key's organization. Repositories and controllers pass `organizationId` into queries. Tests cover cross-org access denial.

### Why use API keys for ingestion?

Services and agents should not log in as users. API keys can be scoped, revoked, hashed, and tied to one organization.

### Why Redis and BullMQ?

Uptime checks are periodic background work. Queues keep that work outside request/response paths and allow retries, concurrency, diagnostics, and future horizontal scaling.

### Why not store all telemetry in VictoriaMetrics?

The project started with MySQL-backed custom telemetry for simpler tenant-scoped queries and integration testing. A production evolution should forward high-volume custom metrics to VictoriaMetrics or another time-series store.

### What would you improve next?

Fix local/container CA trust, complete Docker build and audit, add demo screenshots, tighten CI, add frontend dashboard, add scheduled retention, add persistent quotas, and deploy with managed secrets/TLS/backups.
