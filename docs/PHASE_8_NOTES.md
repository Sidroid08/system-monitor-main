# Phase 8 - Observability Visualization Foundation

## What existed before Phase 8

Phase 7 added API-key-authenticated log and custom metric ingestion backed by MySQL:

- `POST /api/ingest/logs`
- `POST /api/ingest/metrics`
- `GET /api/logs`
- `GET /api/logs/:id`
- `GET /api/metrics`
- `GET /api/metrics/names`

The platform also already had:

- Monitored services and uptime checks.
- Uptime alert rules and alert records.
- Incident lifecycle and incident timeline records.
- VictoriaMetrics/vmagent/Grafana infrastructure monitoring.
- A VictoriaMetrics query proxy under `/api/query`.

What was missing was a dashboard-friendly API layer that combines those records into bounded summaries for a future UI.

## Dashboard Data Flow

```text
Customer service
  | API key ingest
  v
POST /api/ingest/logs        POST /api/ingest/metrics
  |                           |
  v                           v
MySQL log_entries             MySQL metric_samples
  |                           |
  +------------+--------------+
               |
               v
JWT dashboard APIs
  | GET /api/observability/overview
  | GET /api/observability/services/:serviceId/summary
  | GET /api/logs/stats
  | GET /api/metrics/aggregate
  v
Future dashboard frontend

Infrastructure exporters
  |
  v
vmagent -> VictoriaMetrics -> Grafana
  |
  v
JWT-protected /api/query proxy with tenant extra_label isolation
```

MySQL-backed custom telemetry and VictoriaMetrics-backed infrastructure telemetry remain separate in this phase. That is intentional: Phase 8 adds read models and query safety without redesigning storage or building a full OpenTelemetry pipeline.

## Overview Endpoint

Route:

```text
GET /api/observability/overview
```

Returns a 24-hour tenant-scoped summary:

- total monitored services
- services grouped by `UP`, `DOWN`, `DEGRADED`, `UNKNOWN`
- active alerts count
- open incidents count
- average uptime response time
- uptime percentage and check counts
- log counts by level
- metric sample count
- recent alerts
- recent incidents

Security:

- JWT required.
- `VIEWER` or higher can access.
- `organizationId` is always taken from `req.user`.

## Service Summary Endpoint

Route:

```text
GET /api/observability/services/:serviceId/summary?range=24h&bucket=auto
```

Supported ranges:

- `1h`
- `24h`
- `7d`
- `30d`

Supported buckets:

- `auto`
- `15s`
- `30s`
- `1m`
- `5m`
- `15m`
- `1h`
- `6h`
- `1d`

Returns:

- service metadata and current status
- latest uptime check
- uptime percentage for the last 24h and 7d
- response-time series for the selected range
- status-history series for the selected range
- log counts by level for the selected range
- recent service logs
- recent service alerts
- recent service incidents

Safety rules:

- `serviceId` must be a valid UUID.
- `serviceId` must belong to the authenticated organization.
- raw service URL, health path, and tags are not returned by this summary endpoint; it returns boolean target hints instead.
- series buckets are capped to 500 buckets.
- recent logs, alerts, and incidents are bounded.

## Metric Aggregation Endpoint

Route:

```text
GET /api/metrics/aggregate
```

Filters:

- `serviceId`
- `name`
- `range`
- `from`
- `to`
- `bucket`
- `aggregation`
- `groupBy`

Supported aggregations:

- `avg`
- `min`
- `max`
- `sum`
- `count`

Supported grouping:

- `serviceId`
- `name`

Examples:

```text
GET /api/metrics/aggregate?name=checkout_latency_ms&range=24h&bucket=15m&aggregation=avg
GET /api/metrics/aggregate?range=1h&bucket=5m&aggregation=count&groupBy=serviceId,name
```

Implementation notes:

- MySQL time bucketing uses parameterized Prisma raw SQL.
- aggregation functions and group-by columns are whitelisted before SQL is built.
- time ranges are capped to 30 days.
- bucket counts are capped to 500.
- result rows are capped in the repository.
- optional `serviceId` filters are validated against the active organization before querying.

## Log Statistics Endpoint

Route:

```text
GET /api/logs/stats
```

Filters:

- `serviceId`
- `level`
- `range`
- `from`
- `to`
- `bucket`

Returns:

- counts over time by log level
- total counts by level
- top services by log volume
- combined `ERROR` + `FATAL` count

Safety rules:

- JWT and `VIEWER` role required.
- `serviceId` must belong to the active organization.
- time ranges are capped to 30 days.
- bucket counts are capped to 500.
- result rows are capped in the repository.

## VictoriaMetrics Integration Notes

Existing integration:

- `backend/src/lib/vmClient.js`
- `/api/query/instant`
- `/api/query/range`
- `/api/query/labels`

Phase 8 changes:

- query routes now require `VIEWER` or higher instead of only requiring authentication.
- PromQL query length is capped.
- label names are validated.
- range queries enforce a maximum range and bucket count.
- query isolation still uses VictoriaMetrics `extra_label=organization_id=<active org>`.
- added `GET /api/observability/victoriametrics/health` for a dashboard-safe health probe.

Limitations:

- This is still a controlled query proxy, not a full PromQL editor product.
- It does not parse PromQL itself.
- It relies on VictoriaMetrics `extra_label` for tenant isolation.

## Grafana Provisioning Notes

Existing provisioning already includes:

- VictoriaMetrics datasource provisioning under `docker/grafana/provisioning/datasources/`.
- file dashboard provisioning under `docker/grafana/provisioning/dashboards/`.
- a generic infrastructure dashboard under `dashboards/grafana_dashboard.json`.

Phase 8 does not add MySQL-backed Grafana panels because the current Grafana stack only provisions VictoriaMetrics as a datasource. Service uptime, log stats, and custom metric aggregates are now exposed through backend APIs for a future SaaS UI.

## Retention Visibility

Route:

```text
GET /api/observability/retention/status
```

Returns non-sensitive telemetry cleanup configuration:

- log retention days
- metric retention days
- cleanup batch size
- cleanup command name
- cleanup mode (`manual`)

This endpoint is available to `VIEWER` because it does not expose secrets or tenant-specific counts. Future phases can restrict it to `ADMIN` if per-org operational controls are added.

## Security And Performance Limits

- All new dashboard APIs require JWT auth.
- All new dashboard APIs require `VIEWER` or higher.
- All tenant filters use the authenticated organization.
- No endpoint accepts `organizationId` from request body or query.
- `serviceId` filters are UUID-validated and org-scoped.
- Time ranges are capped to 30 days.
- Bucket counts are capped to 500.
- Recent summaries are bounded.
- Raw SQL is limited to time-series bucketing and uses Prisma parameter binding.
- Raw SQL dynamic pieces are whitelisted before use.
- No API keys, hashed keys, SMTP settings, AWS credentials, or webhook configs are returned.

## Known Limitations

- No frontend dashboard was added.
- No schema migration was needed.
- No VictoriaMetrics forwarding for MySQL `MetricSample` rows was added.
- No automated telemetry retention worker was added.
- No MySQL integration test was added for the raw aggregation SQL.
- Alert-to-service matching still relies on uptime alert JSON labels because alerts do not yet have a first-class `serviceId` column.
- Grafana cannot visualize MySQL-backed logs/metrics without a compatible datasource or backend-to-VictoriaMetrics forwarding.

## Phase 9 Recommendation

Phase 9 should focus on API hardening and deployment readiness:

- rate limiting for auth, ingest, and dashboard APIs
- per-org telemetry quotas
- integration tests against Docker MySQL
- backend and worker Dockerfiles
- CI/CD with lint, tests, Prisma validate/generate, and Docker config validation
- production env validation
- structured request logging without sensitive bodies
