# Docker Compose

This folder contains the local Docker Compose stack for the Sidroid monitoring system.

## Services

`docker/docker-compose.yml` can run:

- `mysql`
- `redis`
- `victoriametrics`
- `vmagent`
- `grafana`
- `backend`
- `worker`

The backend and worker use the same image built from `../backend/Dockerfile`. The backend runs `npm start`; the worker runs `npm run worker`.

## Environment

Copy the example file before local use:

```bash
cp .env.example .env
```

Keep `docker/.env` out of Git. The example file contains placeholders only.

Useful local variables:

```text
MYSQL_HOST_PORT=3306
BACKEND_HOST_PORT=5000
MYSQL_DATABASE=sidroid
MYSQL_USER=sidroid_user
MYSQL_PASSWORD=local-dev-password
RATE_LIMIT_STORE=redis
```

If another MySQL server is already listening on port `3306`, use a different host port:

```powershell
$env:MYSQL_HOST_PORT="3308"
docker compose --env-file .env.example up -d mysql redis
```

## Start The Stack

From this `docker/` folder:

```bash
docker compose --env-file .env.example up -d
```

Or from the repository root:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example up -d
```

## Run Migrations

Migrations are intentionally explicit. Run them from `backend/` against the Compose MySQL database:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate status
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npx prisma migrate deploy
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run db:verify-migrations
```

Use the configured host port in `DATABASE_URL` when `MYSQL_HOST_PORT` is not `3306`.

## Seed Demo Data

After migrations, seed the recruiter/demo dataset from `backend/`:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@127.0.0.1:3306/sidroid npm run seed
```

The demo seed uses `.local` users and placeholder service URLs only. It does not print a raw API key.

## Validate Compose

From the repository root:

```bash
docker compose -f docker/docker-compose.yml --env-file docker/.env.example config
```

## Build Backend Image

From the repository root:

```bash
docker build -f backend/Dockerfile backend
```

If the build fails during `npm ci` with `Exit handler never called!`, inspect the npm debug log. In this local environment the underlying cause was registry TLS verification failure (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Fix the local/container CA trust chain rather than disabling TLS verification in the Dockerfile.

## Production Notes

This Compose file is suitable for local development and recruiter/demo validation. Production deployments still need external TLS termination, managed secrets, persistent database backups, log shipping, and environment-specific hardening.
