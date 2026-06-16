# Sidroid Backend

Express/Prisma control-plane backend for the Sidroid monitoring project.

## Stack

- Node.js with ES modules
- Express 5
- Prisma 5
- MySQL
- JWT and bcrypt authentication
- Organization membership and basic RBAC
- Hashed organization-scoped API keys
- Zod request validation
- VictoriaMetrics query proxy

## Setup

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Update local values in `.env`. Do not commit `.env` or real cloud credentials.

3. Install dependencies:

```bash
npm install
```

4. Validate Prisma configuration:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
```

5. Start the backend:

```bash
npm run dev
```

## Validation

```bash
npm run lint
npm test
```

`npm test` runs only real test files under `test/`. The Prisma connectivity probe is available separately:

```bash
npm run db:check
```

`db:check` requires a reachable database and should not be treated as a unit test.

## Main API routes

- `GET /health`
- `GET /health/ready`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/org`
- `GET /api/org/:id`
- `GET /api/aws`
- `POST /api/aws`
- `POST /api/aws/:id/sync`
- `GET /api/instances`
- `GET /api/alert-rules`
- `POST /api/alert-rules`
- `GET /api/notification-channels`
- `POST /api/notification-channels`
- `GET /api/query/instant`
- `GET /api/query/range`
- `GET /api/query/labels`
- `GET /api/api-keys`
- `POST /api/api-keys`
- `POST /api/api-keys/:id/revoke`
- `DELETE /api/api-keys/:id`

Most routes require a bearer token. Tenant-owned routes use the authenticated user's active organization membership.

## Auth and roles

Protected requests require:

- a valid non-expired JWT,
- an active user,
- an active membership in the JWT's organization.

Roles:

- `OWNER`: full org access.
- `ADMIN`: manage most org resources.
- `DEVELOPER`: manage technical resources such as AWS accounts and alert rules.
- `VIEWER`: read-only access.

`User.organizationId` remains as a backward-compatible default organization pointer, while `OrganizationMember` is the membership source of truth.

## API keys

API keys are organization-scoped and hashed before storage. The raw key is returned only once when created.

Supported scopes:

- `metrics:write`
- `logs:write`
- `services:read`
- `alerts:read`

Use `API_KEY_PEPPER` in `.env` for API key hashing. Do not reuse production peppers across environments.

## Migrations

Validate the schema:

```bash
DATABASE_URL=mysql://sidroid_user:local-dev-password@localhost:3306/sidroid npx prisma validate
```

Apply migrations only after reviewing `docs/PHASE_2_NOTES.md`, especially the membership backfill and API key unique-index notes.

## Security notes

- Never commit `.env`, AWS credential exports, PEM/private keys, or webhook URLs.
- AWS account responses intentionally omit stored access keys and secret keys.
- Static AWS keys are still stored by the current development model; production should move to assume-role and/or encrypted secret storage.
