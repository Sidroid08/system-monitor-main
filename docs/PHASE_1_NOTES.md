# Phase 1 Notes

Phase 1 focused on foundation stabilization, security cleanup, route safety, and test hygiene. It intentionally avoided new SaaS product features.

## What was stabilized

- Added a real backend `npm test` script that runs only real test files.
- Moved the Prisma connectivity probe from `backend/src/test-prisma.js` to `backend/scripts/checkPrisma.js`.
- Added `npm run db:check` for explicit local database connectivity checks.
- Fixed `backend/scripts/manualSync.js` to import the current AWS sync module and accept UUID account IDs.
- Removed stale unused helpers:
  - `backend/src/middleware/error.middleware.js`
  - `backend/src/utils/jwt.js`
  - `backend/src/utils/orgCode.js`
  - `backend/src/modules/organizations/org.schemas.js`
- Removed unused `node-cron` after replacing cron scheduling with an explicit evaluator interval timer.
- Added a Prisma schema-alignment migration for alert rules, notification channels, sync logs, and alert rule fields used by the current backend.

## Security issues fixed

- Removed tracked credential/key artifacts from Git:
  - `monitoring-user_accessKeys.csv`
  - `monitoring-user_credentials.csv`
  - `sentinel.pem`
  - `docker/.env`
- Added `docker/.env.example` with empty placeholders.
- Expanded `.gitignore` for private keys, local env files, logs, coverage, and local AI/tool state.
- Updated backend AWS account responses so API responses do not return stored AWS access keys or secret access keys.
- Added `docs/SECURITY_NOTES.md` with rotation guidance.

## Test issues fixed

- `npm test` now avoids accidental execution of utility scripts.
- `src/test-prisma.js` no longer lives under `src/`, so `node --test` cannot accidentally pick it up.
- Expected API errors are no longer logged during test runs when `NODE_ENV=test`.
- Added tests for basic tenant-scope rejection before database access.

## Route protection added

- `/api/org` routes now require authentication.
- Organization reads now return only the authenticated user's organization.
- Organization creation through `/api/org` is disabled; new organizations are created through registration.
- AWS account create/list/sync now uses `req.user.organizationId` and rejects mismatched requested organization IDs.
- Instance list now uses `req.user.organizationId` and no longer parses UUIDs as numbers.
- Alert rules, notification channels, query routes, and AWS/instance routes were reviewed for authentication and tenant scoping.

## Prisma/database notes

- `npx prisma validate` passes with a safe local/dummy `DATABASE_URL`.
- `backend/sql/schema.sql` remains an older historical SQL file and does not match the Prisma schema.
- The new migration aligns Prisma migrations with the current schema, but existing manually modified databases should be checked before running migrations in production.
- Stored AWS credentials and notification configs are still plain database fields; encryption or a secret manager belongs in Phase 2.

## Validation results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | Runs `node --check src/server.js`. |
| `npm test` | Passed | 26 tests passed. |
| `$env:DATABASE_URL='mysql://sidroid_user:local-dev-password@localhost:3306/sidroid'; npx prisma validate` | Passed | Uses a safe local placeholder URL. |
| `docker compose --env-file .env.example config` | Passed | Uses placeholder env values so local secrets are not printed. |

## Remaining risks

- Full RBAC is not implemented.
- API key routes and API-key authentication are not implemented.
- Static AWS credentials can still be stored for development flows.
- Notification channel config is stored as plain JSON text.
- Backend is not containerized.
- Local Compose does not include MySQL, Redis, or the backend.
- `backend/sql/schema.sql` is stale relative to Prisma.
- `file_sd` target generation still needs to be wired into vmagent config in a later phase.

## Phase 2 recommendations

- Add route-level RBAC for `ADMIN`, `MEMBER`, and `VIEWER`.
- Implement API key creation, hashing, scoping, rotation, and revocation.
- Encrypt stored integration secrets or move them to a secret manager.
- Prefer AWS assume-role onboarding over static keys.
- Add integration tests with a disposable database.
- Add CI for lint, tests, Prisma validation, and migration checks.
