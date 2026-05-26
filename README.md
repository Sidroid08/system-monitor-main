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

---

## Next production upgrades

- add `vmalert` for alerting,
- add TLS/reverse proxy,
- add Grafana SSO,
- add EC2 auto-discovery,
- store configs in Git and manage with IaC.
