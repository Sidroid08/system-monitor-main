# VictoriaMetrics Notes

This directory is reserved for future VictoriaMetrics-specific overrides, TLS assets, or enterprise configuration.
The current stack runs VictoriaMetrics directly from `docker-compose.yml`.

## Phase 8 Integration Notes

Grafana currently reads infrastructure metrics from VictoriaMetrics through the provisioned Prometheus-compatible datasource in `docker/grafana/provisioning/datasources/datasource.yml`.

The backend's Phase 8 dashboard APIs read MySQL-backed SaaS telemetry directly:

- service uptime summaries
- alert and incident summaries
- log statistics
- custom metric aggregations

Those APIs are intended for the future product UI. They are not automatically visible in Grafana unless a compatible datasource/plugin is added later or custom metrics are forwarded into VictoriaMetrics.

The backend VictoriaMetrics query proxy remains available for infrastructure metrics:

```text
GET /api/query/instant
GET /api/query/range
GET /api/query/labels
GET /api/observability/victoriametrics/health
```

The query proxy appends `extra_label=organization_id=<active org>` to VictoriaMetrics requests for tenant isolation.
