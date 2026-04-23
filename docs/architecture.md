# Architecture

## Goal
This project provides a production-ready foundation for a **multi-organization monitoring system** where:

- one **organization** maps to one AWS account,
- each organization contains one or more **services**,
- each service contains one or more **nodes**,
- each node exposes host metrics through **node_exporter**.

The metric hierarchy is:

**Organization → Service → Node → Metrics**

## Stack

- **Grafana**: dashboards and variable-based filtering
- **VictoriaMetrics**: long-term metrics storage and Prometheus-compatible query API
- **vmagent**: scraping and forwarding metrics to VictoriaMetrics
- **node_exporter**: Linux host/system metrics collection on EC2 instances
- **Shell scripts**: bootstrap and optional push-based label injection
- **Docker Compose**: local or remote deployment for the monitoring control plane

## Logical data flow

### Pull model (recommended)
1. EC2 nodes run `node_exporter` on port `9100`.
2. `vmagent` scrapes each node on a fixed interval.
3. `vmagent` attaches labels like:
   - `organization_id`
   - `organization_name`
   - `service`
   - `node`
4. `vmagent` remote-writes all scraped metrics into `VictoriaMetrics`.
5. `Grafana` reads from `VictoriaMetrics` and builds dashboards with dropdown variables.

### Push model (optional)
1. A node runs `node_exporter` locally.
2. `send_metrics.sh` fetches `/metrics` from the exporter.
3. The script injects organization labels.
4. The script pushes the labeled metrics into VictoriaMetrics using:
   - `/api/v1/import/prometheus`

The push model is useful when you cannot expose node exporter to the monitoring server, but the pull model is better for large fleets.

## Components

### 1. VictoriaMetrics
VictoriaMetrics stores all time series. It is lightweight, Prometheus-compatible, and well suited for hundreds of nodes.

### 2. vmagent
`vmagent` is the scraper and forwarder. It is more efficient than using a full Prometheus server for this use case. In this project it:

- scrapes many node_exporter targets,
- attaches organization/service/node labels,
- forwards data to VictoriaMetrics,
- can be extended with relabeling, service discovery, or remote_write tuning.

### 3. Grafana
Grafana is automatically provisioned with:

- a preconfigured VictoriaMetrics datasource,
- a dashboard for host monitoring,
- variables for organization, service, and node.

### 4. Node Exporter
Each EC2 instance runs `node_exporter` and exposes standard Linux host metrics such as:

- CPU time
- memory
- disk space
- filesystem stats
- network traffic
- system load

## Labeling model
Each time series should carry the labels below:

- `organization_id`
- `organization_name`
- `service`
- `node`
- `instance`

Example:

```promql
node_cpu_seconds_total{
  organization_id="1001",
  organization_name="CompanyA",
  service="ec2",
  node="ec2-prod-01",
  instance="10.0.0.5:9100"
}
```

## Why this supports scale
This design supports hundreds of nodes because:

- VictoriaMetrics is optimized for high-ingest workloads.
- vmagent is light and efficient for scraping many exporters.
- Labels allow tenant-style separation without duplicating stacks.
- Grafana variables query labels dynamically, so dashboards do not need to be duplicated per organization.

## Recommended production extensions
For larger deployments, add:

- private VPC connectivity or WireGuard between monitoring server and EC2 targets,
- reverse proxy + TLS for Grafana and VictoriaMetrics,
- Grafana SSO,
- alerting with Alertmanager or vmalert,
- infrastructure-as-code for target registration,
- automatic AWS service discovery for EC2 targets.
