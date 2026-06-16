# Production Readiness Checklist

Sidroid is a production-grade foundation. It should not be described as fully production-ready until the remaining blockers are resolved.

## Passed Or Implemented

- Tenant isolation in protected API paths.
- JWT authentication.
- bcrypt password hashing.
- Organization memberships.
- RBAC.
- Hashed organization-scoped API keys.
- Audit logging.
- Monitored service registry.
- Manual uptime checks.
- Redis/BullMQ scheduled uptime workers.
- Worker diagnostics.
- Uptime alert rules.
- Cooldown and deduplication behavior.
- Notification channel model.
- Incident lifecycle.
- Incident timeline events.
- Incident assignment and postmortem fields.
- API-key log ingestion.
- API-key metric ingestion.
- Telemetry query APIs.
- Dashboard-ready observability APIs.
- Rate limiting for auth, ingestion, and expensive reads.
- Request-level telemetry caps.
- Prisma migration chain verification.
- MySQL integration tests.
- GitHub Actions CI added.
- Backend Dockerfile added.
- API and worker Compose services added.
- Docker Compose config validation passes.

## Needs Work Before Real Production

- `npm audit --omit=dev` must pass.
- Docker image build must pass without local TLS/certificate workaround.
- Production secrets must move to a managed secret store.
- TLS/reverse proxy must be added.
- Database backup and restore process must be defined and tested.
- Monitoring for the Sidroid app itself must be added.
- Centralized application log shipping must be added.
- Persistent quotas and billing model must be added.
- Per-org daily/monthly usage accounting must be added.
- Stronger end-to-end integration tests should be added.
- Deployment platform and IaC should be added.
- Log/metric retention should be scheduled, not only manual.
- Full frontend dashboard is still missing.
- Frontend auth/session handling is still missing.
- AI incident summaries are intentionally deferred.

## Current Known Local Blockers

### Docker Build

Command:

```bash
docker build -f backend/Dockerfile backend
```

Current result in this local environment:

```text
npm error Exit handler never called!
```

Prior npm debug evidence pointed to certificate verification, and the current local audit failure confirms the Node/npm CA trust issue still exists:

```text
UNABLE_TO_VERIFY_LEAF_SIGNATURE
```

### Dependency Audit

Command:

```bash
npm audit --omit=dev
```

Current result:

```text
unable to verify the first certificate
```

## Honest Positioning

Safe to say:

- production-style observability SaaS backend
- production-grade foundation
- recruiter-ready backend architecture project
- includes auth, RBAC, workers, alerts, incidents, telemetry, Docker, CI, and integration tests

Do not say yet:

- fully production-ready
- deployed production SaaS
- clean security audit
- Docker image build verified in this local environment
- complete frontend product
