# Phase 6 — Incident Management Foundation

## What existed before Phase 6

Phase 5 added:
- `UptimeAlertRule` model with types: SERVICE_DOWN, SERVICE_DEGRADED, RESPONSE_TIME_ABOVE, CONSECUTIVE_FAILURES
- `Alert` model with statuses: OPEN, ACKNOWLEDGED, RESOLVED
- `handleUptimeStateChange()` in `lib/uptimeAlerts.js` — evaluates rules after each uptime check
- Alert cooldown and deduplication logic
- Notification dispatch (email, Slack, webhook) via `lib/notifier.js`
- Alert management API: GET/POST/PATCH /api/alerts
- Notification channel API: /api/notification-channels

**Alert vs. Incident distinction (important):**
- An **Alert** is a transient signal that a condition fired (e.g. "service returned DOWN").
- An **Incident** is a tracked operational problem with lifecycle, assignment, timeline, and postmortem fields. Alerts can create incidents; incidents outlive individual alerts.

---

## Incident model design

### Prisma model: `Incident`

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| organizationId | String | Tenant scope — always required |
| serviceId | String? | Optional: the affected MonitoredService |
| alertId | String? | Optional: the Alert that triggered creation |
| alertRuleId | String? | Optional: the UptimeAlertRule that fired |
| title | String | Human-readable summary |
| description | String? | Longer description |
| severity | IncidentSeverity | CRITICAL / HIGH / MEDIUM / LOW |
| status | IncidentStatus | OPEN → … → RESOLVED → CLOSED |
| source | IncidentSource | ALERT / MANUAL / SYSTEM |
| assignedToUserId | String? | Active org member assigned to this incident |
| createdByUserId | String? | User who created (null for system-created) |
| acknowledgedByUserId | String? | User who first acknowledged |
| resolvedByUserId | String? | User who resolved |
| acknowledgedAt | DateTime? | When first acknowledged |
| resolvedAt | DateTime? | When resolved |
| closedAt | DateTime? | When closed |
| startedAt | DateTime | Incident start time (defaults to createdAt) |
| impactSummary | String? | Postmortem field |
| rootCause | String? | Postmortem field |
| resolutionSummary | String? | Postmortem field |
| preventionNotes | String? | Postmortem field |
| metadata | Json? | Arbitrary structured data |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

**Indexes:**
- `(organizationId, status)` — filter by org + status
- `(organizationId, serviceId)` — service-scoped incidents
- `(organizationId, severity)` — severity filtering
- `(organizationId, startedAt)` — time-range queries

### Prisma model: `IncidentEvent` (timeline)

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| organizationId | String | Tenant scope |
| incidentId | String | FK → Incident |
| actorUserId | String? | Who triggered this event (null = system) |
| type | IncidentEventType | Enum (see below) |
| message | String | Human-readable event description |
| metadata | Json? | Extra context |
| createdAt | DateTime | Auto |

**Indexes:**
- `(incidentId)` — timeline queries
- `(organizationId, incidentId)` — tenant-safe timeline

**Event types:**
- `CREATED` — incident first opened
- `ACKNOWLEDGED` — status moved to ACKNOWLEDGED
- `STATUS_CHANGED` — any other status change
- `ASSIGNED` — assignee changed
- `COMMENTED` — comment added
- `RESOLVED` — status moved to RESOLVED
- `CLOSED` — status moved to CLOSED
- `ALERT_LINKED` — alert connected to this incident
- `ALERT_RECOVERED` — linked alert resolved
- `SYSTEM_UPDATE` — automated system event

---

## API route summary

Base: `/api/incidents`

| Method | Path | Min role | Description |
|---|---|---|---|
| POST | / | DEVELOPER | Create incident manually |
| GET | / | VIEWER | List org incidents (paginated) |
| GET | /:id | VIEWER | Get incident detail |
| PATCH | /:id | DEVELOPER | Update title/description/severity |
| POST | /:id/acknowledge | DEVELOPER | Mark acknowledged |
| POST | /:id/assign | DEVELOPER (self), ADMIN/OWNER (anyone) | Assign to user |
| POST | /:id/resolve | DEVELOPER | Resolve incident |
| POST | /:id/close | ADMIN/OWNER | Close incident (must be RESOLVED first) |
| POST | /:id/comments | DEVELOPER | Add a comment |
| GET | /:id/timeline | VIEWER | Get timeline events |

All routes require `authenticate` middleware. All incidents are scoped to the authenticated user's `organizationId`.

---

## RBAC / permissions

| Role | Permissions |
|---|---|
| VIEWER | read incidents, read timeline |
| DEVELOPER | + create, acknowledge, assign to self, comment, resolve |
| ADMIN | + assign anyone in org, close |
| OWNER | same as ADMIN |

---

## Lifecycle / status transition rules

```
OPEN → ACKNOWLEDGED
OPEN → INVESTIGATING
OPEN → RESOLVED
ACKNOWLEDGED → INVESTIGATING
ACKNOWLEDGED → RESOLVED
INVESTIGATING → IDENTIFIED
INVESTIGATING → RESOLVED
IDENTIFIED → MONITORING
IDENTIFIED → RESOLVED
MONITORING → RESOLVED
RESOLVED → CLOSED
```

- Transitions not in this list are rejected with 422.
- `CLOSED` incidents are immutable (no status changes; comments allowed by ADMIN/OWNER only by design, but current implementation blocks comments on CLOSED incidents for simplicity).
- `RESOLVED` requires `resolutionSummary` in request body (optional field — enforced as best-effort; API accepts empty resolution for automated paths).
- Each status change writes an `IncidentEvent`.

---

## Alert-to-incident integration

### On alert trigger (in `lib/uptimeAlerts.js`)

When `evaluateOneRule()` creates a new alert:
1. Check if an OPEN/ACKNOWLEDGED/INVESTIGATING/IDENTIFIED/MONITORING incident already exists for `(organizationId, serviceId, alertRuleId)`.
2. If none exists → create incident with `source: ALERT`, linking `alertId` and `alertRuleId`.
3. Write `IncidentEvent` type `CREATED` and `ALERT_LINKED`.
4. Failure in incident creation is caught and does not fail the alert flow.

### On alert resolution (in `lib/uptimeAlerts.js`)

When `evaluateOneRule()` resolves an existing alert:
1. Find linked incident (by `alertId`) that is not RESOLVED/CLOSED.
2. If found → write `IncidentEvent` type `ALERT_RECOVERED` with message that alert recovered.
3. Move incident to `MONITORING` if currently OPEN/ACKNOWLEDGED/INVESTIGATING/IDENTIFIED.
4. Do NOT auto-close or auto-resolve the incident — a human must resolve it.

### Deduplication

The alert dedup (one open alert per rule) already prevents repeated alert creation. The incident dedup additionally checks for any non-terminal incident for the same `(organizationId, serviceId, alertRuleId)` to avoid creating duplicate incidents.

---

## Audit behavior

Audit events written for incidents:
- `incident.created`
- `incident.acknowledged`
- `incident.assigned`
- `incident.status_changed`
- `incident.resolved`
- `incident.closed`
- `incident.comment_added`
- `incident.alert_linked` (written by uptimeAlerts.js integration)

All logged via existing `lib/auditLogger.js` with `resourceType: 'incident'`.

---

## Notification behavior

Phase 6 does **not** add new notification dispatch for incidents.

Rationale:
- Alert notifications from Phase 5 already fire when the underlying alert triggers.
- Adding a second notification for incident creation from the same event would cause spam.
- Escalation policies and incident-specific paging are planned for a future phase.

This is documented here as a known gap to be addressed in Phase 7+.

---

## Tenant isolation rules

- Every DB query filters by `organizationId` derived from the authenticated user's JWT.
- `serviceId`, `alertId`, `alertRuleId` are validated to belong to the same org before use.
- `assignedToUserId` must be an ACTIVE member of the same org.
- Cross-org writes return 404 (not 403) to avoid leaking resource existence.
- Timeline events are indexed and queried by `(organizationId, incidentId)`.

---

## Migration notes

**Migration file:** `backend/prisma/migrations/YYYYMMDD_phase6_incident_management/migration.sql`

This migration is additive:
- Adds two new tables: `incidents`, `incident_events`
- Adds two new enums: `IncidentSeverity`, `IncidentStatus`, `IncidentSource`, `IncidentEventType`
- No existing tables are modified
- Safe to apply to an existing Phase 5 database without downtime risk

To apply:
```bash
cd backend
DATABASE_URL="mysql://..." npx prisma migrate deploy
```

To reset in dev:
```bash
DATABASE_URL="mysql://..." npx prisma migrate dev --name phase6_incident_management
```

---

## Known limitations

1. No escalation policies or paging integrations.
2. Incident notifications not yet wired (alerts still notify; incident creation is silent).
3. No bulk incident operations (bulk acknowledge, bulk resolve).
4. No incident search/filter beyond pagination (title search, date range, severity filter planned for Phase 7).
5. `CLOSED` incidents are fully immutable — if business needs require re-opening, that logic would need to be added.
6. Postmortem fields (impactSummary, rootCause, resolutionSummary, preventionNotes) are free text. A structured postmortem template system is a future enhancement.

---

## What Phase 7 should add next

**Recommended: Logs and Metrics Ingestion Foundation**

- API-key-authenticated ingestion endpoint (`POST /api/ingest/logs`, `POST /api/ingest/metrics`)
- Tenant-scoped log storage model with retention limits
- VictoriaMetrics remote-write forwarding for custom metrics
- Log query API (`GET /api/logs?service=...&from=...&to=...`)
- Retention enforcement worker (BullMQ scheduled job)
- Log streaming connection to Grafana Loki or VictoriaLogs

This builds naturally on the existing API key auth, BullMQ queue infrastructure, and VictoriaMetrics stack.
