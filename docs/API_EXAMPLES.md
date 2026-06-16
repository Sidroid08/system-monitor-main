# API Examples

These examples use placeholders only. Replace:

- `<JWT_TOKEN>` with a user JWT from login.
- `<API_KEY>` with a disposable API key created locally.
- `<SERVICE_ID>` with a service id from `POST /api/services` or `GET /api/services`.
- `<INCIDENT_ID>` with an incident id.
- `<ALERT_ID>` with an alert id.

Base URL:

```text
http://localhost:5000
```

## Auth

Register:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Siddhant",
    "email": "siddhant@example.com",
    "password": "DemoPass123!",
    "organizationName": "Acme Observability"
  }'
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "siddhant@example.com",
    "password": "DemoPass123!"
  }'
```

Current user:

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## API Keys

Create an API key:

```bash
curl -X POST http://localhost:5000/api/api-keys \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Local telemetry demo",
    "scopes": ["logs:write", "metrics:write"]
  }'
```

The raw key is shown once in the create response. Store it only for the local demo and rotate/delete it afterward.

List API keys:

```bash
curl http://localhost:5000/api/api-keys \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Services

Create a monitored service:

```bash
curl -X POST http://localhost:5000/api/services \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API",
    "description": "Customer checkout service",
    "type": "API",
    "environment": "production",
    "url": "https://example.com/health",
    "healthPath": "/health",
    "method": "GET",
    "expectedStatusCode": 200,
    "timeoutMs": 5000,
    "intervalSeconds": 60,
    "tags": {
      "team": "payments",
      "tier": "critical"
    }
  }'
```

List services:

```bash
curl http://localhost:5000/api/services \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Trigger a manual uptime check:

```bash
curl -X POST http://localhost:5000/api/services/<SERVICE_ID>/check \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Telemetry Ingestion

Ingest logs:

```bash
curl -X POST http://localhost:5000/api/ingest/logs \
  -H "X-Api-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {
        "serviceId": "<SERVICE_ID>",
        "level": "ERROR",
        "message": "checkout dependency timeout",
        "source": "checkout-api",
        "environment": "production",
        "traceId": "demo-trace-001",
        "attributes": {
          "route": "/checkout",
          "timeoutMs": 5000
        }
      }
    ]
  }'
```

Ingest metrics:

```bash
curl -X POST http://localhost:5000/api/ingest/metrics \
  -H "X-Api-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": [
      {
        "serviceId": "<SERVICE_ID>",
        "name": "checkout_latency_ms",
        "type": "GAUGE",
        "value": 842,
        "unit": "ms",
        "tags": {
          "route": "/checkout"
        }
      }
    ]
  }'
```

## Logs And Metrics Queries

List logs:

```bash
curl "http://localhost:5000/api/logs?serviceId=<SERVICE_ID>&limit=25" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Log stats:

```bash
curl "http://localhost:5000/api/logs/stats?serviceId=<SERVICE_ID>&range=24h&bucket=5m" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

List metrics:

```bash
curl "http://localhost:5000/api/metrics?serviceId=<SERVICE_ID>&name=checkout_latency_ms&limit=25" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Metric aggregation:

```bash
curl "http://localhost:5000/api/metrics/aggregate?serviceId=<SERVICE_ID>&name=checkout_latency_ms&range=24h&bucket=5m&aggregation=avg&groupBy=serviceId,name" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Alerts

Create an uptime alert rule:

```bash
curl -X POST http://localhost:5000/api/uptime-alert-rules \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Checkout API response time high",
    "serviceId": "<SERVICE_ID>",
    "type": "RESPONSE_TIME_ABOVE",
    "threshold": 750,
    "severity": "HIGH",
    "cooldownSeconds": 300
  }'
```

List alerts:

```bash
curl "http://localhost:5000/api/alerts?status=OPEN&limit=50" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Acknowledge an alert:

```bash
curl -X PATCH http://localhost:5000/api/alerts/<ALERT_ID> \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"ACKNOWLEDGED"}'
```

## Incidents

List incidents:

```bash
curl "http://localhost:5000/api/incidents?status=OPEN&limit=50" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Acknowledge an incident:

```bash
curl -X POST http://localhost:5000/api/incidents/<INCIDENT_ID>/acknowledge \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message":"Investigating checkout API degradation"}'
```

Resolve an incident:

```bash
curl -X POST http://localhost:5000/api/incidents/<INCIDENT_ID>/resolve \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Dependency recovered",
    "rootCause": "Demo upstream timeout",
    "resolutionSummary": "Recovered after retry queue drained"
  }'
```

Incident timeline:

```bash
curl http://localhost:5000/api/incidents/<INCIDENT_ID>/timeline \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Observability

Overview:

```bash
curl "http://localhost:5000/api/observability/overview?range=24h" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Service summary:

```bash
curl "http://localhost:5000/api/observability/services/<SERVICE_ID>/summary?range=24h&bucket=5m" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

VictoriaMetrics health:

```bash
curl http://localhost:5000/api/observability/victoriametrics/health \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
