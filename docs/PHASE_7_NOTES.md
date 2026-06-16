# Phase 7 — Logs and Metrics Ingestion Foundation

## What existed before Phase 7

Phase 6 added:
- Incident management with lifecycle, timeline, and alert-to-incident integration
- Full RBAC-gated incident API
- 206 tests passing

Phase 5 added alert rules, notifications, and uptime evaluation.

The platform had no way to receive external telemetry (logs or custom metrics) from customer services. The only data collection was uptime HTTP checks triggered internally.

---

## Telemetry ingestion architecture

```
External Service
      │
      │  POST /api/ingest/logs   (X-Api-Key: sm_live_...)
      │  POST /api/ingest/metrics (X-Api-Key: sm_live_...)
      ▼
  authenticateApiKey middleware
  (validates key, derives organizationId, enforces scope)
      │
      ▼
  Ingest Controller
  (validates payload, redacts sensitive keys, truncates, inserts batch)
      │
      ▼
  MySQL (LogEntry / MetricSample tables)
      │
      ▼
  User queries via JWT-authenticated API
  GET /api/logs     (VIEWER+)
  GET /api/metrics  (VIEWER+)
  GET /api/metrics/names (VIEWER+)
```

**Key principle:** Ingestion endpoints use API key auth. Query endpoints use JWT user auth. The two auth paths never mix.

---

## API key authentication and scopes

Ingestion routes use the existing `authenticateApiKey` middleware from Phase 2 plus `requireApiKeyScope`. No changes needed to the middleware itself.

| Scope | Grants |
|---|---|
| `logs:write` | POST /api/ingest/logs |
| `metrics:write` | POST /api/ingest/metrics |

- `organizationId` is **always derived from the API key** — never accepted from the request body or query string.
- Revoked or expired API keys return 401.
- Wrong or missing scope returns 403.
- `serviceId` in the request body is validated to belong to the API key's organization.

---

## Log model design

### Prisma model: `LogEntry`

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| organizationId | String | Tenant scope — always derived from API key |
| serviceId | String? | Optional: links to MonitoredService |
| level | LogLevel | DEBUG / INFO / WARN / ERROR / FATAL |
| message | String (VARCHAR 5000) | Truncated at ingest to 5000 chars |
| timestamp | DateTime | Provided by sender; defaults to now |
| source | String? (VARCHAR 100) | Sender label (e.g. "app", "worker") |
| environment | String? (VARCHAR 50) | e.g. "production", "staging" |
| traceId | String? (VARCHAR 128) | Distributed trace ID |
| spanId | String? (VARCHAR 64) | Span ID |
| requestId | String? (VARCHAR 128) | Request/correlation ID |
| attributes | Json? | Structured metadata; sensitive keys redacted |
| ingestionSource | LogIngestionSource | API_KEY / SYSTEM / WORKER |
| receivedAt | DateTime | Server-side receipt time |
| createdAt | DateTime | Auto |

**Indexes:**
- `(organizationId, timestamp, id)` - primary time-range queries and stable cursor pagination
- `(organizationId, serviceId, timestamp, id)` - service-scoped queries
- `(organizationId, level, timestamp, id)` - severity filtering

**Message limit:** Truncated to 5000 chars at ingest. Originals longer than 5000 chars are silently truncated with no error.

**Attributes redaction:** Keys matching any of these patterns are removed before storage:
`password`, `token`, `authorization`, `apikey`, `secret`, `cookie`, `passwd`, `credential`, `private_key`, `access_key`

---

## Metric model design

### Prisma model: `MetricSample`

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| organizationId | String | Tenant scope |
| serviceId | String? | Optional: links to MonitoredService |
| name | String (VARCHAR 200) | Metric name; validated safe pattern |
| type | MetricType | GAUGE / COUNTER / HISTOGRAM |
| value | Float | Must be finite number |
| unit | String? (VARCHAR 50) | Optional unit label |
| timestamp | DateTime | Provided by sender; defaults to now |
| tags | Json? | Structured tags; sensitive keys redacted |
| ingestionSource | MetricIngestionSource | API_KEY / SYSTEM / WORKER |
| receivedAt | DateTime | Server-side receipt time |
| createdAt | DateTime | Auto |

**Indexes:**
- `(organizationId, name, timestamp, id)` - metric time-series queries and stable cursor pagination
- `(organizationId, serviceId, timestamp, id)` - service-scoped queries

**Metric name pattern:** Must match `/^[a-zA-Z_:][a-zA-Z0-9_:.-]{0,199}$/` (Prometheus-compatible).

**Tags redaction:** Same sensitive key list as log attributes.

**Tags size limit:** Max 50 keys per sample; keys and values truncated to 100 chars.

---

## Ingestion API routes

### POST /api/ingest/logs

- **Auth:** API key (`X-Api-Key` header) with `logs:write` scope
- **Body:** Single log object OR `{ logs: [...] }` array (max 100)
- **Partial acceptance:** Each log is validated independently. Invalid items are counted as rejected without failing the batch.
- **Max payload:** 1 MB (existing express.json limit)
- **Response:** `{ accepted, rejected, ids }`

### POST /api/ingest/metrics

- **Auth:** API key (`X-Api-Key` header) with `metrics:write` scope
- **Body:** Single metric object OR `{ metrics: [...] }` array (max 100)
- **Partial acceptance:** Same as logs
- **Response:** `{ accepted, rejected, ids }`

---

## Query API routes

### GET /api/logs

- **Auth:** JWT user (VIEWER+)
- **Filters:** `serviceId`, `level`, `from`, `to`, `search` (message LIKE), `limit` (max 500, default 50), `cursor` (opaque timestamp+id keyset cursor)
- **Sort:** `timestamp DESC, id DESC`
- **Tenant isolation:** `organizationId` always from JWT

### GET /api/logs/:id

- **Auth:** JWT user (VIEWER+)
- Returns single log entry by id, scoped to org

### GET /api/metrics

- **Auth:** JWT user (VIEWER+)
- **Filters:** `serviceId`, `name`, `from`, `to`, `limit` (max 500, default 50), `cursor` (opaque timestamp+id keyset cursor)
- **Sort:** `timestamp DESC, id DESC`

### GET /api/metrics/names

- **Auth:** JWT user (VIEWER+)
- Returns distinct metric names for the org (for UI dropdowns)
- **Response:** `{ names: ["cpu.usage", "http.requests", ...] }`

---

## Validation and size limits

| Field | Limit |
|---|---|
| Batch size | Max 100 items per request |
| Log message | Truncated to 5000 chars |
| Metric name | Max 200 chars, pattern `[a-zA-Z_:][a-zA-Z0-9_:.-]*` |
| Metric value | Must be finite (no NaN/Infinity) |
| Tags/attributes keys | Max 50 keys |
| Tag/attribute key length | Truncated to 100 chars |
| Tag/attribute value | Truncated to 500 chars |
| source field | Max 100 chars |
| environment field | Max 50 chars |
| traceId / spanId / requestId | Max 128 chars each |
| Query limit | Max 500 per request |

---

## Redaction and safety rules

Sensitive attribute/tag keys that are stripped before storage (case-insensitive match):
- `password`, `passwd`, `secret`, `token`, `authorization`, `apikey`, `api_key`,
  `cookie`, `credential`, `credentials`, `private_key`, `access_key`, `secret_key`

**What is NOT done (deliberate):**
- No attempt to scan values for PAN/SSN/email — that is a future enhancement
- No request body logging in the API layer
- Raw API key values are never echoed or stored

---

## Retention cleanup design

**Env vars:**
- `LOG_RETENTION_DAYS` — default 30
- `METRIC_RETENTION_DAYS` — default 30
- `TELEMETRY_RETENTION_BATCH_SIZE` — default 1000 (rows deleted per batch to avoid lock contention)

**Implementation:** `backend/src/queues/telemetry.retention.js` — a standalone ESM script that can be run directly:

```bash
node src/queues/telemetry.retention.js
# or:
npm run telemetry:cleanup
```

**Behavior:**
- Deletes `LogEntry` rows where `receivedAt < now - LOG_RETENTION_DAYS`
- Deletes `MetricSample` rows where `receivedAt < now - METRIC_RETENTION_DAYS`
- Deletes in batches of `TELEMETRY_RETENTION_BATCH_SIZE` with a short pause between batches to avoid replication lag
- Logs count of rows deleted per org per table
- Idempotent — safe to run repeatedly
- **Does NOT run automatically in the API server** — must be triggered as a cron job or scheduled separately
- Cross-tenant safety: each batch query always filters by `receivedAt`, no org-specific filter needed for retention (age-based only)

**Limitations:**
- No per-org retention limit configuration (all orgs share the same global retention window)
- No quota enforcement (total rows per org)
- Quota and per-org limits are planned for Phase 8

---

## Migration notes

**New tables:** `log_entries`, `metric_samples`
**New enums:** `LogLevel`, `LogIngestionSource`, `MetricType`, `MetricIngestionSource`
**Existing tables:** `Organization` updated with new relation fields

Migration file:

- `backend/prisma/migrations/20260616050000_phase7_telemetry_ingestion/migration.sql`

Migration is additive - no existing columns modified. Safe to apply to a Phase 6 database after the Phase 6 incident migration exists:

```bash
cd backend
DATABASE_URL="mysql://..." npx prisma migrate deploy
```

Dev migration status check:
```bash
DATABASE_URL="mysql://..." npx prisma migrate status
```

Repair-pass finding: Phase 6 incident models (`Incident`, `IncidentEvent`, incident enums) are present in `schema.prisma`, but no matching Phase 6 incident migration directory was found under `backend/prisma/migrations`. Treat that as a separate pre-production deployment blocker.

---

## Known limitations

1. No VictoriaMetrics forwarding in Phase 7 (Option A chosen - MySQL-first)
2. No ingestion rate limiting yet
3. No integration tests with a real MySQL database yet
4. No per-org retention configuration
5. No quota enforcement (bytes/rows per org)
6. Log search is simple MySQL LIKE (not full-text index) - adequate for small scale
7. Metrics are raw samples only - no aggregation or rollup
8. No streaming ingest (HTTP only, no WebSocket or gRPC)
9. No ingest pipeline validation for PAN/SSN/email in values
10. Batch ingestion does not support idempotent re-delivery (no dedup key)
11. Telemetry cleanup must be run as an external cron - no automatic scheduler

---

## What Phase 8 should add next

**Recommended: Prometheus/Grafana/VictoriaMetrics integration polish + dashboards + telemetry visualization**

- VictoriaMetrics remote-write adapter for MetricSample forwarding
- Grafana dashboard provisioning for ingested metrics
- Log aggregation counts (error rate, level breakdown per service)
- Per-org usage quota model (LogEntry/MetricSample row counts)
- Per-org retention configuration
- Alerting on ingested log patterns (e.g. ERROR rate threshold)
- Public status page foundation (read-only, no auth, org-specific subdomain or slug)
