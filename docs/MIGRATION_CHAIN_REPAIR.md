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

## Verification Result In This Environment

Passed:

- `npx prisma validate`
- `npx prisma generate`
- `npm run lint`
- `npm test`
- `docker compose -f docker/docker-compose.yml --env-file docker/.env.example config`

Not verified:

- `npx prisma migrate status`
- fresh database `npx prisma migrate deploy`

Reason:

- TCP port `localhost:3306` was reachable.
- Prisma authentication failed for the documented local placeholder `sidroid_user`.
- Prisma authentication also failed for the documented local root placeholder.
- The MySQL CLI is not installed in this environment.

Do not treat migration deployment as fully verified until `migrate status` and a fresh local/dev `migrate deploy` pass with valid local credentials.

## Remaining Limitations

- No real MySQL integration test was added in this repair.
- Existing deployed databases may need manual review if migrations were applied out of order before this repair.
- The repair intentionally does not add foreign keys for scalar-only reference fields because that would diverge from the current Prisma schema.
