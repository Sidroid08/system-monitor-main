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

`npm test` runs only real test files under `test/`. The Prisma connectivity probe is available separately:

```bash
npm run db:check
```

`db:check` requires a reachable database and should not be treated as a unit test.

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

## Migrations

Validate the schema:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
```

Apply migrations only after reviewing `docs/PHASE_2_NOTES.md`, `docs/PHASE_3_NOTES.md`, and `docs/PHASE_4_NOTES.md`.

## Security notes

- Never commit `.env`, AWS credential exports, PEM/private keys, or webhook URLs.
- AWS account responses intentionally omit stored access keys and secret keys.
- Static AWS keys are still stored by the current development model; production should move to assume-role and/or encrypted secret storage.
