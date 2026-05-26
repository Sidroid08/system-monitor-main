# AWS EC2 Setup

## What to install on each EC2 node
Each monitored EC2 instance needs:

- Linux access with sudo
- outbound internet or artifact access to download node_exporter
- `node_exporter` listening on port `9100`

## Security group rules
### On monitored EC2 nodes
Allow inbound `TCP 9100` **only** from the monitoring server or its security group.

### On the monitoring server
Allow outbound access to the node subnet on `9100`.

## Example rollout
### CompanyA AWS account
- `ec2-prod-01` → `10.0.1.11:9100`
- `ec2-prod-02` → `10.0.1.12:9100`

### CompanyB AWS account
- `ec2-test-01` → `10.1.2.21:9100`

## Install steps on the EC2 instance
1. Copy `scripts/install_node_exporter.sh` to the server.
2. Run:

```bash
sudo bash install_node_exporter.sh
```

3. Confirm:

```bash
curl http://localhost:9100/metrics | head
```

## Register the node in the monitoring control plane
Edit `configs/vmagent_config.yml` on the monitoring server and add the node under the correct organization.

## Private networking
Recommended production patterns:

- same VPC
- VPC peering
- transit gateway
- VPN / WireGuard mesh
- private hosted zone DNS for node names

## Public internet warning
Do not expose `node_exporter` to the public internet. Restrict it to private subnets or tightly scoped security groups.
