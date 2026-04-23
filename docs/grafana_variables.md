# Grafana Variables

The dashboard uses three query variables powered by VictoriaMetrics.

## Organization
Query:

```promql
label_values(node_cpu_seconds_total, organization_name)
```

This returns all organization names present in the stored metrics.

## Service
Query:

```promql
label_values(node_cpu_seconds_total{organization_name="$organization"}, service)
```

In the included dashboard, regex matching is used to support the `All` option:

```promql
label_values(node_cpu_seconds_total{organization_name=~"$organization"}, service)
```

## Node
Query:

```promql
label_values(node_cpu_seconds_total{organization_name="$organization",service="$service"}, node)
```

In the included dashboard, regex matching is used to support the `All` option:

```promql
label_values(node_cpu_seconds_total{organization_name=~"$organization",service=~"$service"}, node)
```

## Example panel filters
### CPU
```promql
100 - (avg by (organization_name, service, node) (
  rate(node_cpu_seconds_total{mode="idle",organization_name=~"$organization",service=~"$service",node=~"$node"}[5m])
) * 100)
```

### Memory
```promql
100 * (1 - (
  node_memory_MemAvailable_bytes{organization_name=~"$organization",service=~"$service",node=~"$node"}
  /
  node_memory_MemTotal_bytes{organization_name=~"$organization",service=~"$service",node=~"$node"}
))
```

### Disk
```promql
100 * (1 - (
  node_filesystem_avail_bytes{mountpoint="/",organization_name=~"$organization",service=~"$service",node=~"$node"}
  /
  node_filesystem_size_bytes{mountpoint="/",organization_name=~"$organization",service=~"$service",node=~"$node"}
))
```

## Best practices
- Keep `organization_name` stable once deployed.
- Make `node` human-readable, such as `ec2-prod-01`.
- Use `service` as a clean grouping label: `ec2`, `rds-exporter`, `nginx`, and so on.
- Prefer regex selectors in Grafana variables when using the `All` option.
