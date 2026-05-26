# Troubleshooting

## Grafana opens but no metrics appear
Check these in order:

1. `docker compose ps` shows all containers running.
2. `curl http://localhost:8428/health` returns OK.
3. `curl http://localhost:8429/targets` shows node_exporter targets.
4. `curl http://<node-ip>:9100/metrics | head` works from the monitoring host.
5. The target labels exist in `configs/vmagent_config.yml`.

## Dropdowns are empty
Possible causes:

- node_exporter has not been scraped yet,
- labels were not attached,
- datasource provisioning failed,
- dashboard loaded before data existed.

Check:

```bash
docker logs vmagent --tail=100
docker logs grafana --tail=100
```

Then refresh Grafana after at least one scrape interval.

## Node Exporter is not reachable
Verify security groups and host firewall rules allow inbound access on `9100` from the monitoring server.

On the node:

```bash
sudo systemctl status node_exporter
ss -lntp | grep 9100
```

## Wrong organization or node labels
Open `configs/vmagent_config.yml` and verify the labels under the target block.

A single typo in `organization_name` or `node` causes the dashboard filters to split data incorrectly.

## send_metrics.sh fails
Check:

- `NODE_EXPORTER_URL` is reachable,
- `VICTORIAMETRICS_URL` points to the right host,
- variables are exported,
- there is network access to port `8428`.

Manual test:

```bash
curl http://127.0.0.1:9100/metrics | head
curl http://monitoring-server:8428/health
```

## Docker volume or path issues
If Grafana provisioning files are not mounted correctly, make sure you run the compose command from the `docker/` directory exactly as documented.

## Scaling recommendations
For hundreds of nodes:

- keep scrape interval at `15s` or `30s`,
- avoid overly high-cardinality labels,
- do not encode dynamic request IDs or user IDs as labels,
- size disk for VictoriaMetrics retention,
- move to HTTPS and private networking.
