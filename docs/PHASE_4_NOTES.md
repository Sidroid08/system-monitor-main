# Phase 4 Notes

Phase 4 turns the Phase 3 manual uptime check foundation into a scheduled worker-based monitoring loop.

The project remains on the existing Node.js/Express, Prisma, and MySQL stack. Redis and BullMQ are added for durable background jobs. This phase does not add frontend screens, AI summaries, full incident management, or notification dispatch from uptime checks.

## What Phase 4 extends

Phase 3 already provided:

- tenant-scoped `MonitoredService` records,
- `UptimeCheck` persistence,
- manual HTTP checks,
- status calculation,
- SSRF protections,
- audit logs for user-triggered service actions.

Phase 4 adds:

- Redis configuration,
- BullMQ queue foundation,
- scheduled due-service producer,
- uptime worker process,
- queue diagnostics endpoint,
- additive scheduling metadata on monitored services,
- Docker Compose Redis/MySQL support for local development.

## Worker architecture

Text diagram:

```text
API process
  |
  | manages services and manual checks
  v
MySQL <-------------------------------+
  ^                                   |
  |                                   |
Uptime scheduler process              |
  | scans active due services         |
  | enqueues safe job payloads        |
  v                                   |
Redis / BullMQ queue: uptime-checks   |
  |                                   |
  v                                   |
Uptime worker process ----------------+
  loads service by org/service id
  runs SSRF-protected HTTP check
  stores UptimeCheck
  updates service derived status
```

Recommended local process layout:

- API: `npm run dev`
- worker plus scheduler: `npm run worker`
- worker only: `npm run worker:uptime`
- scheduler only: `npm run scheduler:uptime`

The API server does not start uptime schedulers. This avoids duplicate schedulers when multiple API replicas are running.

## Queue design

Queue:

- name: `uptime-checks`
- job name: `run-uptime-check`

Job payloads contain only safe identifiers:

- `organizationId`
- `serviceId`
- `requestedBy: "system"`
- `source: "scheduler"`

Jobs do not contain:

- service URLs,
- headers,
- credentials,
- API keys,
- response bodies,
- full service configuration.

The worker reloads the service from MySQL for every job and scopes lookup by both `organizationId` and `serviceId`.

## Scheduler behavior

The scheduler finds services that are:

- active,
- not soft-deleted,
- service type `HTTP`, `API`, or `WEB`,
- due based on `nextCheckAt` when present,
- otherwise due based on `lastCheckedAt + intervalSeconds`,
- immediately due if never checked.

The scheduler scans a bounded batch controlled by `UPTIME_SCHEDULER_SCAN_LIMIT`.

Duplicate protection:

- BullMQ `jobId` is generated from service id and an interval time bucket.
- Repeated scheduler cycles in the same bucket should not create duplicate jobs for the same service.
- After a check is stored, `nextCheckAt` is updated so completed checks do not get re-enqueued until the next interval.

Known scaling limitation:

- This is safe for small/medium development scale.
- Large production scale should shard scheduler work by organization, service hash bucket, or region and should add stronger distributed scheduler coordination.

## Uptime worker behavior

The worker:

- receives BullMQ jobs,
- validates the job payload,
- loads the service by `organizationId` and `serviceId`,
- skips missing, inactive, or deleted services,
- reuses the Phase 3 SSRF-protected HTTP check logic,
- stores an `UptimeCheck`,
- updates service status fields,
- updates `nextCheckAt`,
- updates simple consecutive success/failure counters.

Status persistence:

- `UP`: stored as an uptime check and increments `consecutiveSuccesses`.
- `DOWN`: stored as an uptime check and increments `consecutiveFailures`.
- `DEGRADED`: stored as an uptime check and resets simple streak counters for now.

## Retry and failure rules

Important distinction:

- A customer service being `DOWN` is a valid monitoring result.
- A `DOWN` result completes the BullMQ job successfully.
- BullMQ job failure is reserved for internal failures such as DB errors, malformed job payloads, or unexpected worker exceptions.

Retry behavior:

- attempts: `3`
- backoff: exponential
- initial delay: `5000ms`
- completed jobs retained: latest `1000`
- failed jobs retained: latest `5000`

This avoids endless retries for normal service outages while still retrying transient worker infrastructure failures.

## Diagnostics

Added:

- `GET /api/worker-health`

Access:

- requires authentication,
- restricted to `OWNER` and `ADMIN`.

The endpoint reports:

- Redis configured/ready state,
- queue name,
- waiting/active/delayed/completed/failed/paused counts,
- scheduler interval,
- scheduler scan limit,
- worker concurrency.

If `REDIS_URL` is missing, the endpoint reports Redis as not configured instead of making the API process fail at startup.

## Environment variables

Backend:

```text
REDIS_URL=redis://localhost:6379
UPTIME_SCHEDULER_INTERVAL_SECONDS=15
UPTIME_SCHEDULER_SCAN_LIMIT=100
UPTIME_WORKER_CONCURRENCY=5
```

`REDIS_URL` is required for worker/scheduler runtime helpers. It is not required for normal API startup or unit tests.

## Docker Compose notes

The existing Compose file was a metrics stack. Phase 4 adds:

- MySQL for local backend development,
- Redis for BullMQ workers.

The backend API and uptime worker are still run as local npm processes. A backend Dockerfile and migration entrypoint should be added later before placing API/worker containers in Compose.

Local infra:

```bash
cd docker
docker compose --env-file .env.example up -d mysql redis victoriametrics vmagent grafana
```

Then from `backend/`:

```bash
npm install
npx prisma migrate dev
npm run dev
npm run worker
```

## Prisma/database changes

Added fields to `MonitoredService`:

- `nextCheckAt`
- `lastCheckSource`
- `consecutiveFailures`
- `consecutiveSuccesses`

Added index:

- `organizationId`, `isActive`, `nextCheckAt`

Migration:

- `backend/prisma/migrations/20260616030000_scheduled_uptime_workers/migration.sql`

Manual note:

- Existing services with `nextCheckAt = null` are evaluated by `lastCheckedAt + intervalSeconds`.
- Never-checked services are considered due.

## Testing strategy

Tests mock:

- BullMQ queue add behavior,
- Prisma service scans,
- worker repository calls,
- HTTP checks.

Tests do not require:

- Redis,
- live MySQL,
- internet access,
- AWS credentials.

Coverage added for:

- active due services are enqueued,
- inactive/not-due services are skipped,
- duplicate job ids are counted safely,
- worker loads by organization and service id,
- inactive/missing services are skipped,
- `UP` and `DOWN` results complete normally,
- internal errors propagate for BullMQ retry,
- missing `REDIS_URL` fails only for worker runtime helpers,
- diagnostics route controller behavior.

## Phase 5 hook design

The worker currently persists uptime checks and updates service summary fields. Phase 5 should connect alert rule evaluation and notifications to this stored result.

Recommended next step:

- add service-uptime alert rule types,
- evaluate rules after `UptimeCheck` persistence,
- create alerts from sustained `DOWN` or `DEGRADED` status,
- send notifications through existing notification channels,
- keep incident creation separate until alert state transitions are stable.

## Known limitations

- No multi-region probe workers yet.
- No distributed scheduler lock beyond BullMQ job ids.
- No uptime alert evaluation yet.
- No notification dispatch from uptime checks yet.
- No status page or incident model yet.
- No API-key ingestion for external uptime checks yet.
- Backend and worker containers are not added yet because the repo does not have a safe Dockerfile/migration entrypoint.
