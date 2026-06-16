# Screenshots And Demo Media

No frontend screenshots are included yet. Do not fake UI screenshots.

## Suggested Screenshots To Capture

1. Grafana dashboard from the existing provisioned dashboard.
2. `GET /api/observability/overview` response in Postman, Insomnia, or terminal.
3. `GET /api/observability/services/<SERVICE_ID>/summary` response.
4. `GET /api/logs/stats` response.
5. `GET /api/metrics/aggregate` response.
6. `GET /api/incidents/<INCIDENT_ID>/timeline` response.
7. Docker Desktop or terminal showing Compose services running.
8. GitHub Actions CI passing after the remote environment runs.
9. Terminal output for `npm test` and `npm run test:integration`.
10. Migration verification output from `npm run db:verify-migrations`.

## Suggested Demo GIF Or Video Flow

1. Start Compose services.
2. Apply migrations.
3. Run `npm run seed`.
4. Start API and worker.
5. Login and copy JWT.
6. List seeded services.
7. Create a disposable API key.
8. Ingest one log and one metric.
9. Query overview and service summary.
10. Show seeded alert and incident timeline.
11. End on the README architecture diagram and production checklist.

## Screenshot Naming Suggestion

If screenshots are added later, place them under:

```text
docs/assets/screenshots/
```

Suggested names:

- `grafana-dashboard.png`
- `overview-api-response.png`
- `service-summary-response.png`
- `incident-timeline-response.png`
- `docker-compose-services.png`
- `ci-passing.png`

Keep screenshots free of real secrets, real customer URLs, real AWS account ids, and raw API keys.
