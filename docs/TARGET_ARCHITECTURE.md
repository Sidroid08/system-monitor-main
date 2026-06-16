# Target Architecture

This document describes a realistic target architecture for evolving the current monitoring project into a production-grade multi-tenant observability SaaS.

The current backend is Node.js/Express with Prisma and MySQL. A future FastAPI/PostgreSQL rewrite is optional, but the safer path is to stabilize the current stack first and evolve in small phases.

## High-level architecture

```text
Browser / API clients
        |
        v
SaaS frontend
        |
        v
API gateway / reverse proxy / TLS
        |
        v
Backend API
        |
        +--> Auth, organizations, RBAC
        +--> Service registry
        +--> API keys
        +--> Health-check config
        +--> Alert rules
        +--> Incidents
        +--> Status pages
        |
        +--> Primary database
        |
        +--> Redis / queue
                 |
                 v
              Workers
                 |
                 +--> uptime checks
                 +--> AWS sync
                 +--> alert evaluation
                 +--> notification delivery
                 +--> AI summary jobs

Agents / exporters / integrations
        |
        +--> metrics ingestion --> VictoriaMetrics / Prometheus-compatible storage
        +--> logs ingestion ----> log store
        +--> node_exporter -----> vmagent --> VictoriaMetrics

Grafana
        |
        v
VictoriaMetrics datasource
```

## Core modules

### Authentication

Responsibilities:

- Register users and create initial organizations.
- Login and issue tokens.
- Support password reset and email verification later.
- Support refresh/session invalidation later.
- Protect all tenant data routes.

Current state:

- JWT login/register exists.
- bcrypt password hashing exists.
- No refresh/session invalidation yet.

### Organizations and tenancy

Responsibilities:

- Store organizations, users, memberships, roles, and tenant settings.
- Ensure every tenant-owned row has `organizationId`.
- Enforce tenant isolation in every repository query.

Current state:

- `organizationId` exists on core models.
- Some routes are already scoped through `req.user.organizationId`.
- Public organization routes need review.

### RBAC

Responsibilities:

- Define what admins, members, and viewers can do.
- Enforce route-level permissions.
- Add tests for denied access.

Suggested starter policy:

- `ADMIN`: manage org settings, users, API keys, services, alerts, notifications.
- `MEMBER`: manage services, alerts, incidents.
- `VIEWER`: read dashboards, services, incidents, and status.

### API keys

Responsibilities:

- Create scoped API keys for agents and integrations.
- Store only key hashes.
- Support rotation, expiration, and revocation.
- Add scopes such as `metrics:write`, `logs:write`, `checks:write`, and `read`.

Current state:

- `ApiKey` model exists.
- API key routes and middleware are not implemented yet.

### Service registry

Responsibilities:

- Represent customer services independently from infrastructure instances.
- Link services to checks, metrics, logs, alert rules, and incidents.
- Support service ownership and tags.

Suggested entities:

- `Service`
- `ServiceEnvironment`
- `ServiceEndpoint`
- `ServiceTag`

### Health checks and uptime monitoring

Responsibilities:

- Schedule HTTP/TCP checks.
- Record status, response time, status code, and error message.
- Calculate uptime windows and latency summaries.
- Trigger alerts when checks fail.

Worker model:

- API stores check definitions.
- Queue schedules due checks.
- Worker performs checks and writes results.
- Alert evaluator reads results and opens or resolves alerts/incidents.

### Metrics

Responsibilities:

- Continue using VictoriaMetrics for Prometheus-compatible metrics.
- Keep tenant labels mandatory.
- Provide query APIs that enforce tenant isolation.
- Support customer agents and Prometheus remote write later.

Current state:

- vmagent and VictoriaMetrics are present.
- Backend query API uses VictoriaMetrics `extra_label`.

### Logs

Responsibilities:

- Accept structured logs through authenticated ingestion.
- Link logs to organization, service, environment, severity, and trace/request IDs.
- Support basic search and incident context.

Starter option:

- Use PostgreSQL/MySQL JSON columns only for small demo volume, or choose a dedicated store later.

Production option:

- Loki, ClickHouse, or OpenSearch depending on query needs and operational budget.

### Alerts

Responsibilities:

- Evaluate metric, uptime, and log-based rules.
- Deduplicate repeated failures.
- Route notifications by severity and service/team.
- Track delivery attempts.

Current state:

- Alert rules and evaluator exist.
- Evaluator currently runs inside the API process and should move to a worker.

### Incidents

Responsibilities:

- Convert alert groups into incidents.
- Track status, severity, owner, timeline, comments, linked services, and resolution.
- Drive status pages and AI summaries.

Suggested lifecycle:

```text
OPEN -> ACKNOWLEDGED -> MITIGATED -> RESOLVED
```

### Notification channels

Responsibilities:

- Store email, Slack, webhook, and future PagerDuty/Opsgenie config.
- Encrypt secret channel config.
- Retry failed deliveries.
- Record delivery logs.

Current state:

- Email, Slack, and generic webhook support exists.
- Config is stored as plain JSON and should be encrypted before production.

### Status pages

Responsibilities:

- Show public or private status for selected services.
- Publish incidents and maintenance windows.
- Avoid exposing internal metrics or tenant data.

Suggested entities:

- `StatusPage`
- `StatusPageService`
- `MaintenanceWindow`
- `IncidentUpdate`

### AI incident summaries

Responsibilities:

- Generate post-incident summaries from incident timelines, alerts, metrics, logs, and operator notes.
- Redact secrets and sensitive customer data.
- Keep summaries editable and auditable.

Do this only after incidents and telemetry links are reliable.

## Infrastructure components

### Primary database

Current: MySQL through Prisma.

Acceptable target:

- Keep MySQL if the current codebase remains Express/Prisma.
- Move to PostgreSQL only as a deliberate migration after tests and migrations are healthy.

Stores:

- Organizations
- Users
- Memberships and RBAC
- Services
- Health checks
- Alert rules
- Incidents
- API key hashes
- Notification channel metadata
- Audit logs

### Redis and workers

Redis should back queues, locks, and short-lived coordination.

Worker jobs:

- AWS sync
- uptime checks
- alert evaluation
- notification delivery
- incident summary generation
- cleanup and retention tasks

### VictoriaMetrics, Prometheus, and Grafana

Recommended role:

- VictoriaMetrics stores time-series data.
- vmagent scrapes exporters and forwards metrics.
- Grafana provides advanced dashboards and operator views.
- SaaS frontend provides product workflows and tenant-safe views.

### Docker and deployment

Local development Compose should eventually include:

- backend API
- database
- Redis
- VictoriaMetrics
- vmagent
- Grafana

Production should add:

- TLS reverse proxy
- secret manager
- backups
- health checks
- CI/CD
- observability for the SaaS itself

## Entry-level hero project constraints

Keep the architecture impressive but buildable:

- Prefer one backend API and one worker process before microservices.
- Prefer one primary database before splitting storage.
- Use VictoriaMetrics/Grafana for metrics instead of building a metrics engine.
- Add AI only after incident data is clean.
- Add Kubernetes only after Docker Compose and CI/CD are reliable.
- Keep each phase demoable and testable.
