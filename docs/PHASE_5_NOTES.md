# Phase 5 — Alerting & Notifications

## Overview

Phase 5 builds rule-based uptime alerting on top of the Phase 4 scheduled worker infrastructure. Each organization can configure `UptimeAlertRule` records that define when an alert should fire, how long to wait before re-notifying (cooldown), and which notification channel to target.

---

## New Data Model

### `UptimeAlertRule`

| Field                  | Type                    | Notes                                                      |
|------------------------|-------------------------|------------------------------------------------------------|
| `id`                   | UUID                    | Primary key                                                |
| `organizationId`       | UUID FK → Organization  | Multi-tenancy scope (required, indexed)                    |
| `serviceId`            | UUID FK → MonitoredService | Optional — if null, rule applies to all org services   |
| `name`                 | String (max 200)        | Human-readable label                                       |
| `type`                 | UptimeRuleType enum     | `SERVICE_DOWN \| SERVICE_DEGRADED \| RESPONSE_TIME_ABOVE \| CONSECUTIVE_FAILURES` |
| `severity`             | AlertSeverity enum      | `LOW \| MEDIUM \| HIGH \| CRITICAL`, default `MEDIUM`      |
| `isActive`             | Boolean                 | Disabled rules are never evaluated                         |
| `threshold`            | Int?                    | Required for `RESPONSE_TIME_ABOVE` (ms) and `CONSECUTIVE_FAILURES` (count) |
| `cooldownSeconds`      | Int                     | Minimum seconds between notifications, 0–86400, default 300 |
| `notificationChannelId`| UUID FK → NotificationChannel | Optional; if null, uses the org default channel    |
| `createdByUserId`      | UUID FK → User          | Audit trail for rule creation                              |
| `lastFiredAt`          | DateTime?               | Engine-managed — used for cooldown calculation             |
| `lastResolvedAt`       | DateTime?               | Engine-managed — set when condition clears                 |

Migration: `backend/prisma/migrations/20260616040000_phase5_uptime_alert_rules/migration.sql`

---

## API Surface

### Uptime Alert Rules (`/api/uptime-alert-rules`)

| Method   | Path    | Auth         | Description                      |
|----------|---------|--------------|----------------------------------|
| `GET`    | `/`     | Authenticated | List rules for the org (filterable by `serviceId`, `isActive`) |
| `GET`    | `/:id`  | Authenticated | Get a single rule                |
| `POST`   | `/`     | DEVELOPER+   | Create a rule                    |
| `PATCH`  | `/:id`  | DEVELOPER+   | Update a rule (partial)          |
| `DELETE` | `/:id`  | DEVELOPER+   | Delete a rule                    |

**RBAC:** `VIEWER` role cannot create, update, or delete rules. Enforced by `requireAnyRole(OWNER, ADMIN, DEVELOPER)` middleware on mutating routes.

**Cross-org guard:** `serviceId` and `notificationChannelId` are validated to belong to the authenticated organization before any write is committed. A `400 Bad Request` is returned if either FK points to another org's record.

### Alerts (`/api/alerts`) — existing, unchanged

List, get, acknowledge, and resolve alerts. All queries are scoped by `organizationId`.

---

## Alert Evaluation Engine (`src/lib/uptimeAlerts.js`)

### Entry point

```
handleUptimeStateChange({ service, check }, deps?)
```

Called after every uptime check is stored — from both the BullMQ worker and the manual `POST /api/services/:id/check` endpoint.

### Two paths

**Rule-based (primary):** When the org has at least one active `UptimeAlertRule` that targets the service (by `serviceId`) or the org in general (`serviceId = null`):

1. Load active rules via `loadActiveRulesForService(orgId, serviceId)`.
2. For each rule, evaluate `conditionMet(rule, service, check)`.
3. If condition is **met**:
   - Check cooldown: `now - rule.lastFiredAt < cooldownSeconds * 1000` → skip if within window.
   - Check dedup: `findOpenAlertForRule(orgId, ruleId)` → skip if an open/acknowledged alert already exists.
   - Create `Alert` with `source: 'uptime-rule'`, `labels` containing `uptimeRuleId` and `serviceId`.
   - Update `rule.lastFiredAt`.
   - Write audit log: `alert.triggered`.
   - Fire-and-forget dispatch via `setImmediate`.
4. If condition is **not met** and an open alert exists for this rule:
   - Resolve the alert via `resolveAlertById`.
   - Update `rule.lastResolvedAt`.
   - Write audit log: `alert.resolved`.
   - Fire-and-forget recovery notification via `setImmediate`.
5. All rules are evaluated via `Promise.allSettled` — one rule failing does not block others.

**Fallback (generic):** When no active rules are configured for the service:

- Compares `service.currentStatus` (before this check) to `check.status`.
- UP/DEGRADED/UNKNOWN → DOWN/DEGRADED: opens a generic alert (`source: 'uptime-check'`) unless one already exists.
- DOWN/DEGRADED → UP: resolves all open `uptime-check` alerts for the service and sends a recovery notification.
- No-op if status is unchanged.

### Condition evaluation (`conditionMet`)

Pure exported function — safe to unit-test without I/O:

| Rule type              | Fires when                                                                              |
|------------------------|----------------------------------------------------------------------------------------|
| `SERVICE_DOWN`         | `check.status === 'DOWN'`                                                              |
| `SERVICE_DEGRADED`     | `check.status === 'DOWN' \|\| check.status === 'DEGRADED'`                            |
| `RESPONSE_TIME_ABOVE`  | `check.responseTimeMs > rule.threshold` (strictly above; null responseTimeMs = false) |
| `CONSECUTIVE_FAILURES` | `(service.consecutiveFailures + 1) >= rule.threshold` (pre-increment for DOWN checks) |

`consecutiveFailures` on `service` is the value **before** `createUptimeCheck` runs. The engine adds 1 to compute the effective count for the current check.

---

## Notification Behaviour

- **Fire-and-forget:** All notification dispatches happen inside `setImmediate(...).catch(() => {})`. A notification failure never causes the uptime check to fail or the BullMQ job to be retried.
- **Channel routing:** If the rule has `notificationChannelId`, the alert is routed to that specific channel via `dispatchAlertToChannel`. Otherwise the org-default channel dispatch is used.
- **Payload safety:** Notification payloads include: `serviceName`, `severity`, `status`, `responseTimeMs`, `httpStatusCode`, `checkedAt`, `errorMessage` (reason). They explicitly **exclude**: API keys, credentials, response bodies, raw headers, secrets of any kind.
- **Recovery notifications:** When a condition clears (or a service recovers in the fallback path), a recovery alert with `severity: LOW` and a `[RESOLVED]` prefix in the title is dispatched through the same channel.

---

## RBAC Summary

| Action                    | VIEWER | DEVELOPER | ADMIN | OWNER |
|---------------------------|--------|-----------|-------|-------|
| List / get rules          | ✓      | ✓         | ✓     | ✓     |
| Create rule               | ✗      | ✓         | ✓     | ✓     |
| Update rule               | ✗      | ✓         | ✓     | ✓     |
| Delete rule               | ✗      | ✓         | ✓     | ✓     |
| List / get / resolve alerts | ✓    | ✓         | ✓     | ✓     |

---

## Audit Log Events

| Event                       | Trigger                                       |
|-----------------------------|-----------------------------------------------|
| `uptime_alert_rule.created` | Rule created via `POST /api/uptime-alert-rules` |
| `uptime_alert_rule.updated` | Rule updated via `PATCH /api/uptime-alert-rules/:id` |
| `uptime_alert_rule.deleted` | Rule deleted via `DELETE /api/uptime-alert-rules/:id` |
| `alert.triggered`           | Rule condition met → new alert opened         |
| `alert.resolved`            | Rule condition cleared → open alert resolved  |
| `alert.acknowledged`        | Operator acknowledges via `PATCH /api/alerts/:id` |
| `service.check_triggered`   | Manual uptime check via `POST /api/services/:id/check` |

---

## Files Changed

```
backend/prisma/schema.prisma
  — Added UptimeRuleType enum and UptimeAlertRule model with all FKs and back-relations.

backend/prisma/migrations/20260616040000_phase5_uptime_alert_rules/migration.sql
  — MySQL DDL for uptime_alert_rules table.

backend/src/modules/uptime-alert-rules/uptimeAlertRules.schemas.js   [NEW]
backend/src/modules/uptime-alert-rules/uptimeAlertRules.repository.js [NEW]
backend/src/modules/uptime-alert-rules/uptimeAlertRules.controller.js [NEW]
backend/src/modules/uptime-alert-rules/uptimeAlertRules.routes.js     [NEW]
  — Full CRUD module for UptimeAlertRule with cross-org guards and RBAC.

backend/src/modules/alerts/alerts.repository.js
  — Added findOpenAlertForRule and resolveAlertById.

backend/src/lib/uptimeAlerts.js
  — Rewritten: rule-based evaluation, cooldown, dedup, recovery notifications, fallback path.

backend/src/modules/services/services.controller.js
  — Added onCheckStored hook wired to handleUptimeStateChange (fire-and-forget, lazy import).

backend/src/queues/uptime.worker.js
  — Wrapped onCheckStored call in try/catch so notification errors never cause BullMQ retries.

backend/src/app.js
  — Registered /api/uptime-alert-rules route.

backend/test/uptime-alerts.test.js
  — Rewritten: added conditionMet tests, rule-based path tests, cooldown/dedup/recovery coverage.

backend/test/uptime-alert-rules.test.js [NEW]
  — Schema validation, controller CRUD, cross-org guard, audit log tests.

backend/package.json
  — Added uptime-alert-rules.test.js to the test script.
```

---

## Validation Results

### `prisma validate`
```
The schema at prisma/schema.prisma is valid 🚀
```

### `prisma generate`
```
✔ Generated Prisma Client (v5.22.0) in 295ms
```

### `npm test`
```
# tests 153
# pass  153
# fail  0
```
Test suite grew from 91 (Phase 4) to 153. New tests: 62 (33 uptime-alert-rules, 29 uptime-alerts expansion).

### `npm audit --omit=dev`
```
UNABLE TO RUN — TLS certificate verification failed (local network / corporate proxy issue).
```
The npm registry endpoint returns a certificate that cannot be verified in this environment. This is a network infrastructure issue, not a package vulnerability. No new production dependencies were added in Phase 5; all new files are pure application logic using existing dependencies (Zod, Prisma, Express).

---

## Security Notes

- All `UptimeAlertRule` queries are scoped by `organizationId` — cross-tenant data access is impossible.
- `serviceId` and `notificationChannelId` on rules are validated to belong to the same org before any write.
- Notification payloads contain no secrets, credentials, API keys, response bodies, or raw headers.
- Disabled rules (`isActive: false`) are excluded by `loadActiveRulesForService` which filters `isActive: true`.
- Notification failure is silently swallowed (`setImmediate + .catch(() => {})`) and never propagates to the check storage path or BullMQ job result.
