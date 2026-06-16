# Multi-Organization Monitoring System

A production-ready starter project for monitoring **multiple organizations (AWS accounts)** with:

- Grafana
- VictoriaMetrics
- vmagent
- Node Exporter
- Docker Compose
- Linux shell automation

Each organization can contain services such as EC2, and each EC2 node exposes metrics that are labeled and filtered in Grafana.

---

## Included features

- Multi-organization metric model: `organization_id`, `organization_name`, `service`, `node`, `instance`
- VictoriaMetrics as the metrics backend
- vmagent scraping and forwarding
- Grafana auto-provisioned datasource and dashboard
- Dynamic Grafana dropdowns:
  - Organization
  - Service
  - Node
- Dashboard panels for:
  - CPU Usage
  - Memory Usage
  - Disk Usage
  - Network Traffic
  - System Load
- Linux installer for node_exporter
- Optional push-based script to label and push metrics
- Example configs for multiple AWS organizations

---

## Folder structure

```text
monitoring-system/
│
├── docker/
│   ├── docker-compose.yml
│   ├── grafana/
│   │   └── provisioning/
│   └── victoriametrics/
│
├── scripts/
│   ├── install_node_exporter.sh
│   ├── send_metrics.sh
│   └── install_monitoring_stack.sh
│
├── dashboards/
│   └── grafana_dashboard.json
│
├── configs/
│   ├── vmagent_config.yml
│   └── prometheus_scrape_example.yml
│
├── aws/
│   └── ec2_setup.md
│
├── docs/
│   ├── architecture.md
│   ├── setup_guide.md
│   ├── grafana_variables.md
│   └── troubleshooting.md
│
└── README.md
```

---

## Quick start

### 1. Configure your EC2 targets
Edit:

`configs/vmagent_config.yml`

Replace the example target IPs with your real EC2 node_exporter endpoints.

### 2. Start the monitoring stack
Open a terminal inside the `docker/` folder and run:

```bash
docker compose up -d
```

or:

```bash
docker-compose up -d
```

### 3. Access Grafana
- URL: `http://localhost:3000`
- Username: `admin`
- Password: `admin123`

### 4. Install node_exporter on each Linux EC2 instance

```bash
sudo bash scripts/install_node_exporter.sh
```

If running from a copied script on the node, just use:

```bash
sudo bash install_node_exporter.sh
```

### 5. Open the dashboard
Go to:

**Sidroid Monitoring → Multi-Organization AWS Node Monitoring**

---

## Example organization model

### Organization 1
- `organization_id=1001`
- `organization_name=CompanyA`
- `service=ec2`
- nodes:
  - `ec2-prod-01`
  - `ec2-prod-02`

### Organization 2
- `organization_id=2001`
- `organization_name=CompanyB`
- `service=ec2`
- nodes:
  - `ec2-test-01`

---

## Recommended deployment model

Use the **pull model** for production:

- install `node_exporter` on every EC2 node,
- let `vmagent` scrape those nodes,
- store all metrics in `VictoriaMetrics`,
- visualize in Grafana.

Use the included `send_metrics.sh` only when a push workflow is required.

---

## Important notes

- Run the compose command from the `docker/` directory so the relative mounts work.
- Keep node_exporter private and reachable only from the monitoring server.
- For hundreds of nodes, keep labels low-cardinality and use private networking.

---

## Documentation

- Architecture: `docs/architecture.md`
- Setup guide: `docs/setup_guide.md`
- Grafana variables: `docs/grafana_variables.md`
- Troubleshooting: `docs/troubleshooting.md`
- AWS EC2 setup: `aws/ec2_setup.md`
- Phase 0 repository audit: `docs/REPO_AUDIT.md`
- Phase 1 stabilization notes: `docs/PHASE_1_NOTES.md`
- Phase 2 auth/RBAC/multitenancy notes: `docs/PHASE_2_NOTES.md`
- Phase 3 service uptime monitoring notes: `docs/PHASE_3_NOTES.md`
- Phase 4 scheduled uptime worker notes: `docs/PHASE_4_NOTES.md`
- Phase 5 alerting notes: `docs/PHASE_5_NOTES.md`
- Phase 6 incident management notes: `docs/PHASE_6_NOTES.md`
- Phase 7 telemetry ingestion notes: `docs/PHASE_7_NOTES.md`
- Phase 8 observability visualization notes: `docs/PHASE_8_NOTES.md`
- Phase 9 production hardening notes: `docs/PHASE_9_NOTES.md`
- Production hardening guide: `docs/PRODUCTION_HARDENING.md`
- Security notes: `docs/SECURITY_NOTES.md`
- Production roadmap: `docs/PRODUCTION_ROADMAP.md`
- Target SaaS architecture: `docs/TARGET_ARCHITECTURE.md`

---

## SaaS upgrade status

This repository is being evolved from a monitoring stack plus backend control plane into a multi-tenant observability SaaS. Phase 9 adds production-hardening foundations around the existing backend: rate limiting, ingestion request quotas, MySQL integration tests, backend/worker containers, Compose polish, CI, and deployment documentation. It does not add a frontend, AI features, billing, or a database redesign.

---

## Backend validation

From `backend/`:

```powershell
npm run lint
npm test
$env:RUN_INTEGRATION_TESTS="true"; $env:DATABASE_URL="mysql://sidroid_user:local-dev-password@localhost:3306/sidroid"; npm run test:integration
$env:DATABASE_URL="mysql://sidroid_user:local-dev-password@localhost:3306/sidroid"; npx prisma validate
$env:DATABASE_URL="mysql://sidroid_user:local-dev-password@localhost:3306/sidroid"; npx prisma generate
$env:DATABASE_URL="mysql://sidroid_user:local-dev-password@localhost:3306/sidroid"; npm run db:verify-migrations
```

From `docker/`:

```bash
docker compose --env-file .env.example config
```

Keep `.env`, `docker/.env`, AWS credential CSV exports, PEM/private keys, logs, and local tool state out of Git. Use `.env.example` files for placeholders only.

---

## Completed backend phases

| Phase | What was built |
|---|---|
| Phase 0 | Repo audit and production roadmap |
| Phase 1 | Foundation stabilization, test hygiene, secrets audit |
| Phase 2 | Auth hardening, RBAC, org membership, API keys, audit logs |
| Phase 3 | Monitored services, uptime checks, SSRF protection |
| Phase 4 | Redis/BullMQ queue, scheduled uptime worker, Docker Compose |
| Phase 5 | Uptime alert rules, cooldown/dedup, notification dispatch |
| Phase 6 | **Incident management**: incident model, lifecycle, timeline, alert-to-incident integration |
| Phase 7 | **Telemetry ingestion**: logs/metrics ingest via API keys, JWT query APIs, retention cleanup |
| Phase 8 | **Observability visualization APIs**: overview, service summaries, metric aggregation, log stats, retention/VM health |
| Phase 9 | **Production hardening foundation**: rate limiting, telemetry request quotas, MySQL integration tests, backend/worker Docker support, CI |

---

## Phase 6: Incident Management

Phase 6 adds production-style incident management on top of the alerting system.

**Features:**
- Incident model with 7-status lifecycle: OPEN → ACKNOWLEDGED → INVESTIGATING → IDENTIFIED → MONITORING → RESOLVED → CLOSED
- Incident timeline events (CREATED, ACKNOWLEDGED, STATUS_CHANGED, ASSIGNED, COMMENTED, RESOLVED, CLOSED, ALERT_LINKED, ALERT_RECOVERED)
- Alert-to-incident integration: triggered alerts automatically create incidents; resolved alerts add ALERT_RECOVERED events and move incidents to MONITORING
- Postmortem fields: impactSummary, rootCause, resolutionSummary, preventionNotes
- RBAC: VIEWER read-only, DEVELOPER create/ack/assign-self/comment/resolve, ADMIN/OWNER close + assign anyone
- Full tenant isolation and audit logging

**API routes:**
```
POST   /api/incidents
GET    /api/incidents
GET    /api/incidents/:id
PATCH  /api/incidents/:id
POST   /api/incidents/:id/acknowledge
POST   /api/incidents/:id/assign
POST   /api/incidents/:id/resolve
POST   /api/incidents/:id/close
POST   /api/incidents/:id/comments
GET    /api/incidents/:id/timeline
```

See `docs/PHASE_6_NOTES.md` for full design documentation.

---

## Phase 7: Telemetry Ingestion

Phase 7 adds a MySQL-backed ingestion foundation for service logs and custom metric samples.

**Features:**
- API-key-authenticated ingestion endpoints for logs and metrics.
- Required ingestion scopes: `logs:write` and `metrics:write`.
- JWT-protected query APIs for logs, log detail, metric samples, and metric names.
- Tenant isolation from API key organization scope for ingest and JWT organization scope for reads.
- Sensitive telemetry attribute/tag redaction before storage.
- Manual retention cleanup script: `npm run telemetry:cleanup`.

**API routes:**
```
POST /api/ingest/logs
POST /api/ingest/metrics
GET  /api/logs
GET  /api/logs/:id
GET  /api/metrics
GET  /api/metrics/names
```

See `docs/PHASE_7_NOTES.md` for migration notes, environment variables, pagination behavior, and known production gaps.

---

## Phase 8: Observability Visualization APIs

Phase 8 adds dashboard-ready read APIs for a future SaaS UI.

**API routes:**
```
GET /api/observability/overview
GET /api/observability/services/:serviceId/summary
GET /api/observability/retention/status
GET /api/observability/victoriametrics/health
GET /api/metrics/aggregate
GET /api/logs/stats
```

**Highlights:**
- JWT + VIEWER access for dashboard reads.
- tenant scope from the authenticated user's active organization.
- 30-day maximum query range.
- 500-bucket maximum for time-series responses.
- service filters validated against the active organization.
- parameterized MySQL bucketing for metric aggregates and log statistics.
- VictoriaMetrics query proxy now has stronger route-level RBAC and range validation.

See `docs/PHASE_8_NOTES.md` for dashboard data flow, endpoint contracts, limits, and known limitations.

---

## Phase 9: Production Hardening Foundation

Phase 9 makes the backend easier to validate, containerize, and run safely.

**Highlights:**
- Rate limits for auth, telemetry ingestion, observability, logs, metrics, and VictoriaMetrics query routes.
- API-key/org-aware ingestion limiting with safe 429 responses.
- Accepted-row caps for logs and metrics ingestion requests.
- Optional Docker MySQL integration tests and migration verification script.
- Backend Dockerfile and shared worker container support.
- Compose backend/worker services with configurable MySQL/backend host ports.
- GitHub Actions CI for lint, unit tests, Prisma, Compose config, Docker build, and MySQL integration tests.

See `docs/PHASE_9_NOTES.md`, `docs/PRODUCTION_HARDENING.md`, and `docker/README.md`.

---

## Next production upgrades

- recruiter-ready README polish and demo narrative
- demo seed data
- architecture diagrams and screenshots
- final deployment walkthrough
- per-org daily telemetry quotas and plan limits
- production secret manager integration
- database backup/restore runbooks
- reverse proxy and TLS termination
- VictoriaMetrics remote-write for custom metrics
- Retention enforcement worker
- add `vmalert` for infrastructure alerting
- add Grafana SSO
- add EC2 auto-discovery
- store configs in Git and manage with IaC
