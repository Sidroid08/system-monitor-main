# Demo Guide

This guide is for a local recruiter/interview demo. It uses placeholder data only.

## Prerequisites

- Node.js 22+
- Docker Desktop
- backend dependencies installed with `npm install`
- `.env` created from `backend/.env.example`

## Start Local Infrastructure

From the repository root:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d mysql redis victoriametrics vmagent grafana
```

If local MySQL already uses `3306`, use a different host port:

```powershell
$env:MYSQL_HOST_PORT="3308"
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d mysql redis
```

## Apply Migrations

From `backend/`:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate status
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate deploy
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run db:verify-migrations
```

Use the configured MySQL host port in `DATABASE_URL`.

## Seed Demo Data

From `backend/`:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run seed
```

The demo seed creates:

- organization: `sidroid-demo`
- users:
  - `owner@sidroid.local`
  - `developer@sidroid.local`
  - `viewer@sidroid.local`
- local demo password: `DemoPass123!`
- monitored services:
  - Checkout API
  - Public Status Page
- uptime checks
- logs
- metrics
- notification channel placeholder
- uptime alert rule
- PromQL-style alert rule
- open alert
- investigating incident with timeline events

Safety notes:

- No real credentials are used.
- No raw API key is generated or printed.
- Seeded emails use `.local`.
- The webhook URL is a localhost placeholder.
- The script resets operational demo data for `sidroid-demo` before reseeding.

## Start API And Worker

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd backend
npm run worker
```

## Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sidroid.local","password":"DemoPass123!"}'
```

Copy the JWT from the response and use it as `<JWT_TOKEN>`.

## Create A Disposable API Key

```bash
curl -X POST http://localhost:5000/api/api-keys \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Local demo telemetry","scopes":["logs:write","metrics:write"]}'
```

Copy the raw key once and use it as `<API_KEY>`.

## Inspect Seeded Services

```bash
curl http://localhost:5000/api/services \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

Copy the Checkout API id and use it as `<SERVICE_ID>`.

## Trigger A Manual Uptime Check

```bash
curl -X POST http://localhost:5000/api/services/<SERVICE_ID>/check \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

The example URL points to `https://example.com/...`, so this is a safe demo request.

## Ingest A Demo Log

```bash
curl -X POST http://localhost:5000/api/ingest/logs \
  -H "X-Api-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"logs":[{"serviceId":"<SERVICE_ID>","level":"ERROR","message":"demo checkout timeout","environment":"production"}]}'
```

## Ingest A Demo Metric

```bash
curl -X POST http://localhost:5000/api/ingest/metrics \
  -H "X-Api-Key: <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"metrics":[{"serviceId":"<SERVICE_ID>","name":"checkout_latency_ms","type":"GAUGE","value":912,"unit":"ms"}]}'
```

## View Overview And Service Summary

```bash
curl "http://localhost:5000/api/observability/overview?range=24h" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

```bash
curl "http://localhost:5000/api/observability/services/<SERVICE_ID>/summary?range=24h&bucket=5m" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Trigger Alert And Incident Discussion

The seed already includes a demo alert and incident. For an interview walkthrough:

1. Show the seeded service list.
2. Show log stats and metric aggregation.
3. Show open alerts.
4. Show the incident and timeline.
5. Explain how uptime rules can create alerts and incidents after worker checks.

Useful endpoints:

```bash
curl "http://localhost:5000/api/alerts?status=OPEN" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

```bash
curl "http://localhost:5000/api/incidents?status=INVESTIGATING" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

```bash
curl http://localhost:5000/api/incidents/<INCIDENT_ID>/timeline \
  -H "Authorization: Bearer <JWT_TOKEN>"
```
