# Setup Guide

## 10-minute quick start

### 1. Prepare local environment values

Copy the example file and set values locally:

```bash
cp docker/.env.example docker/.env
```

Do not commit `docker/.env`, cloud credential exports, `.pem` files, or private keys.

### 2. Edit node targets
Open:

- `configs/vmagent_config.yml`

Replace example targets with your EC2 private IPs or DNS names.

### 3. Start the stack
From the `docker/` directory, run:

```bash
docker compose up -d
```

If your system only supports the legacy command:

```bash
docker-compose up -d
```

### 4. Open services

- Grafana: `http://localhost:3005`
- VictoriaMetrics: `http://localhost:8428`
- vmagent: `http://localhost:8429`

Grafana login values come from your local environment:

- user: `GRAFANA_ADMIN_USER`
- password: `GRAFANA_ADMIN_PASSWORD`

### 5. Install node exporter on each EC2 node
Copy `scripts/install_node_exporter.sh` to each Linux instance and run:

```bash
sudo bash install_node_exporter.sh
```

### 6. Verify connectivity
From the monitoring host, confirm a target is reachable:

```bash
curl http://10.0.1.11:9100/metrics | head
```

### 7. Open the dashboard
In Grafana, open:

**Sidroid Monitoring / Multi-Organization AWS Node Monitoring**

## Local deployment
This project is ideal for a single VM or small control-plane server. Minimum suggestion:

- 2 vCPU
- 4 GB RAM
- 20+ GB disk

## Remote deployment
Deploy the `docker/` stack on a dedicated monitoring VM and make sure the VM can reach all EC2 nodes on port `9100`.

Open only what is required:

- Grafana `3000/tcp`
- VictoriaMetrics `8428/tcp` only if needed externally
- vmagent `8429/tcp` only for administration or metrics inspection
- Node Exporter `9100/tcp` only from the monitoring server or inside the VPC

## Adding a new organization
Add a new scrape job or a new target block inside `configs/vmagent_config.yml`.

Example:

```yaml
- job_name: companyc-ec2
  static_configs:
    - targets: ["10.2.3.10:9100"]
      labels:
        organization_id: "3001"
        organization_name: "CompanyC"
        service: "ec2"
        node: "ec2-app-01"
```

Then restart vmagent:

```bash
cd docker
docker compose restart vmagent
```

## Adding a new EC2 node
Add another target under the matching organization block:

```yaml
- targets: ["10.0.1.13:9100"]
  labels:
    organization_id: "1001"
    organization_name: "CompanyA"
    service: "ec2"
    node: "ec2-prod-03"
```

Restart vmagent after updating the config.

## Using the push script instead of scraping
On a node, set environment variables and run:

```bash
ORGANIZATION_ID=1001 \
ORGANIZATION_NAME=CompanyA \
SERVICE=ec2 \
NODE_NAME=ec2-prod-01 \
VICTORIAMETRICS_URL=http://monitoring-server:8428 \
NODE_EXPORTER_URL=http://127.0.0.1:9100/metrics \
./send_metrics.sh
```

For scheduled pushes, add a cron entry such as:

```cron
* * * * * /opt/monitoring/send_metrics.sh >> /var/log/send_metrics.log 2>&1
```

## Security checklist before making the repo public

- No `.env` files are committed.
- No AWS CSV credential exports are committed.
- No `.pem`, `.key`, or private SSH files are committed.
- Any previously committed AWS/IAM credentials have been revoked and replaced.
- Grafana admin credentials are provided through local environment variables only.

## Recommended rollout order
1. Deploy the monitoring stack.
2. Install node_exporter on one EC2 test node.
3. Confirm metrics arrive in VictoriaMetrics.
4. Confirm Grafana dropdowns populate.
5. Add more organizations and nodes.
6. Lock down security groups.
