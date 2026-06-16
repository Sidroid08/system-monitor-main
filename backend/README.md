# Sidroid Backend

Express/Prisma control-plane backend for the Sidroid monitoring project.

## Stack

- Node.js with ES modules
- Express 5
- Prisma 5
- MySQL
- JWT and bcrypt authentication
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

Most routes require a bearer token. Tenant-owned routes use the authenticated user's `organizationId`.

## Security notes

- Never commit `.env`, AWS credential exports, PEM/private keys, or webhook URLs.
- AWS account responses intentionally omit stored access keys and secret keys.
- Static AWS keys are still stored by the current development model; production should move to assume-role and/or encrypted secret storage.
