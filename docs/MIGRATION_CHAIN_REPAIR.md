# Migration Chain Repair

This note documents the focused repair that makes the Phase 6 and Phase 7 Prisma migration chain consistent with `backend/prisma/schema.prisma`.

## Problem

Phase 7 repair added:

- `backend/prisma/migrations/20260616050000_phase7_telemetry_ingestion/migration.sql`

That repair also found a blocker:

- `Incident` and `IncidentEvent` existed in `schema.prisma`.
- Incident-related enums existed in `schema.prisma`.
- No Phase 6 incident migration directory existed under `backend/prisma/migrations`.

That meant a fresh database using `prisma migrate deploy` would create Phase 7 telemetry tables but would never create Phase 6 incident tables.

## Migration Added

Added:

- `backend/prisma/migrations/20260616045000_phase6_incident_management/migration.sql`

The timestamp intentionally sorts after Phase 5 and before Phase 7.

The migration creates:

- `incidents`
- `incident_events`

It includes incident enum columns for:

- severity: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`
- status: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `IDENTIFIED`, `MONITORING`, `RESOLVED`, `CLOSED`
- source: `ALERT`, `MANUAL`, `SYSTEM`
- event type: `CREATED`, `ACKNOWLEDGED`, `STATUS_CHANGED`, `ASSIGNED`, `COMMENTED`, `RESOLVED`, `CLOSED`, `ALERT_LINKED`, `ALERT_RECOVERED`, `SYSTEM_UPDATE`

It includes indexes matching `schema.prisma`:

- `incidents_organizationId_status_idx`
- `incidents_organizationId_serviceId_idx`
- `incidents_organizationId_severity_idx`
- `incidents_organizationId_startedAt_idx`
- `incidents_alertId_idx`
- `incidents_alertRuleId_idx`
- `incident_events_incidentId_idx`
- `incident_events_organizationId_incidentId_idx`

It includes only the foreign keys modeled in Prisma:

- `incidents.organizationId -> organizations.id`
- `incident_events.organizationId -> organizations.id`
- `incident_events.incidentId -> incidents.id`

Fields such as `serviceId`, `alertId`, `alertRuleId`, `assignedToUserId`, `createdByUserId`, `acknowledgedByUserId`, `resolvedByUserId`, and `actorUserId` are scalar references in the current Prisma schema. They are validated in application code and are not Prisma relations, so this repair does not add database foreign keys for them.

## Migration Order

Current relevant order:

1. `20260616040000_phase5_uptime_alert_rules`
2. `20260616045000_phase6_incident_management`
3. `20260616050000_phase7_telemetry_ingestion`

This order is correct:

- Phase 5 creates `uptime_alert_rules`.
- Phase 6 creates incident lifecycle and timeline tables.
- Phase 7 creates telemetry ingestion tables.

Phase 7 does not depend on Phase 6 tables directly, but both migrations must exist for a fresh Phase 7 database to match the current Prisma schema.

## Verification Commands

Run from `backend/`:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma generate
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma migrate status
```

Run from the repository root:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example config
```

For a fresh database check, create an empty local/dev MySQL database with non-production credentials and run:

```bash
DATABASE_URL=mysql://<local-user>:<local-password>@localhost:3306/<empty-dev-db> npx prisma migrate deploy
```

Then confirm these tables exist:

- `incidents`
- `incident_events`
- `log_entries`
- `metric_samples`
- `uptime_alert_rules`
- `monitored_services`
- `uptime_checks`

## Verification Result In This Environment

Verified on 2026-06-16 against Docker MySQL from `docker/docker-compose.yml` and `docker/.env.example`.

Environment note:

- The base Compose MySQL service maps `3306:3306`.
- Local port `3306` was already owned by a host `mysqld` process, so the default `docker compose up -d mysql` could not bind the port.
- Initial command that failed: `docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d mysql`
- Error: `ports are not available: exposing port TCP 0.0.0.0:3306 -> 127.0.0.1:0: listen tcp 0.0.0.0:3306: bind: Only one usage of each socket address (protocol/network address/port) is normally permitted.`
- Likely cause: an existing local MySQL server was already listening on host port `3306`.
- Recommended fix: stop or reconfigure the host MySQL process for local Compose use, or make the Compose host port configurable, for example `${MYSQL_HOST_PORT:-3306}:3306`.
- To avoid disturbing the existing local MySQL process, verification used the same Compose MySQL service with a temporary local override outside the repository:
  - container: `sidroid-mysql-verify`
  - host port: `3307`
  - disposable database: `sidroid_migration_verify`

Migration verification:

- `npx prisma migrate status` before deploy correctly reported 8 pending migrations on the empty database.
- `npx prisma migrate deploy` applied all 8 migrations successfully:
  - `20260327055638_init`
  - `20260616000000_phase1_schema_alignment`
  - `20260616010000_auth_rbac_multitenancy`
  - `20260616020000_service_uptime_monitoring`
  - `20260616030000_scheduled_uptime_workers`
  - `20260616040000_phase5_uptime_alert_rules`
  - `20260616045000_phase6_incident_management`
  - `20260616050000_phase7_telemetry_ingestion`
- `npx prisma migrate status` after deploy passed with `Database schema is up to date!`

Required tables confirmed in the fresh database:

- `incidents`
- `incident_events`
- `log_entries`
- `metric_samples`
- `uptime_alert_rules`
- `monitored_services`
- `uptime_checks`

Additional checks passed:

- `npx prisma validate`
- `npx prisma generate`
- `npm run lint`
- `npm test`
- `docker compose -f docker/docker-compose.yml --env-file docker/.env.example config`

## Remaining Limitations

- No real MySQL integration test was added in this repair.
- Existing deployed databases may need manual review if migrations were applied out of order before this repair.
- The repair intentionally does not add foreign keys for scalar-only reference fields because that would diverge from the current Prisma schema.
