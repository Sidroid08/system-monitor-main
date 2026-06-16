# Phase 2 Notes

Phase 2 added the SaaS identity and authorization foundation while keeping the existing Node.js/Express, Prisma, and MySQL stack.

## Current auth and org structure found

Before Phase 2:

- `User` had a required `organizationId` and a legacy `role`.
- JWTs carried `sub`, `organizationId`, and `role`.
- Auth middleware verified JWT shape but did not load the user or membership from the database.
- Basic tenant scoping existed for several routes, but it depended heavily on `req.user.organizationId` from the token.
- `ApiKey` existed in Prisma but did not have scopes, prefixes, revocation timestamps, or route support.
- Audit logs did not exist.

## Changes made

- Added `OrganizationMember` with `OWNER`, `ADMIN`, `DEVELOPER`, and `VIEWER` roles.
- Added membership statuses: `ACTIVE`, `INVITED`, and `DISABLED`.
- Kept `User.organizationId` for backward compatibility as the default/active org pointer.
- Registration now creates an `OWNER` membership for the first user.
- Auth middleware now verifies JWTs, loads the user, and validates active organization membership.
- Added reusable RBAC helpers.
- Added organization-scoped API key create/list/revoke routes.
- Added audit log model and helper.
- Added tenant isolation and API-key safety tests.

## RBAC role matrix

| Role | Read org resources | Manage AWS accounts | Manage alert rules | Manage notification channels | Manage API keys |
| --- | --- | --- | --- | --- | --- |
| `OWNER` | Yes | Yes | Yes | Yes | Yes |
| `ADMIN` | Yes | Yes | Yes | Yes | Yes |
| `DEVELOPER` | Yes | Yes | Yes | No | View metadata only |
| `VIEWER` | Yes | No | No | No | No |

Notes:

- This is intentionally simple. It is not a full permission engine.
- Ownership transfer, invites, billing, and team management are deferred.

## API key design

- API keys belong to one organization.
- Raw keys use `sm_live_...` in production and `sm_test_...` outside production.
- Only the HMAC hash is stored in the database.
- The raw key is returned only once during creation.
- List responses return metadata only.
- Keys support scopes:
  - `metrics:write`
  - `logs:write`
  - `services:read`
  - `alerts:read`
- Keys can be revoked with `POST /api/api-keys/:id/revoke` or `DELETE /api/api-keys/:id`.
- API-key authentication middleware exists for future ingestion routes but is not wired into any ingestion endpoint yet.

## Audit log design

Audit logs capture:

- `organization.created`
- `api_key.created`
- `api_key.revoked`
- `aws_account.created`
- `aws_account.synced`
- `notification_channel.created`
- `notification_channel.updated`
- `notification_channel.deleted`
- `notification_channel.tested`
- `alert_rule.created`
- `alert_rule.updated`
- `alert_rule.deleted`

Audit fields include organization, actor, action, resource type/id, metadata, IP address, user agent, and timestamp.

Audit writes are best-effort. A failed audit write is logged outside tests but does not crash the user action.

## Tenant isolation rules

- Protected requests require an active organization membership.
- Route handlers derive organization scope from the authenticated context.
- Client-supplied organization IDs are rejected if they do not match the active organization.
- API key list/create/revoke operations are scoped to the active organization.
- Mutation routes use role checks before hitting controllers.

## Prisma migration notes

Added migration:

- `backend/prisma/migrations/20260616010000_auth_rbac_multitenancy/migration.sql`

The migration:

- Creates `organization_members`.
- Backfills existing users into memberships.
- Adds API key prefix/scopes/revocation/last-used metadata.
- Creates `audit_logs`.

Manual caution:

- Existing users are mapped from legacy roles:
  - `ADMIN` -> `OWNER`
  - `MEMBER` -> `DEVELOPER`
  - `VIEWER` -> `VIEWER`
- Existing inactive users are backfilled as disabled memberships.
- Existing API key rows receive empty scopes. Review old keys before using them for ingestion.
- The migration adds unique indexes on `api_keys.keyHash` and `api_keys.prefix`; check old data for duplicates before applying to a shared database.

## Validation results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run lint` | Passed | Syntax check for backend entrypoint. |
| `npm test` | Passed | 33 tests passed. |
| `$env:DATABASE_URL='mysql://sidroid_user:local-dev-password@localhost:3306/sidroid'; npx prisma validate` | Passed | Uses a safe placeholder database URL. |
| `npx prisma generate` | Passed | Regenerated local Prisma client after schema changes. |
| `docker compose --env-file .env.example config` | Passed | Uses placeholder Docker env values; no local secrets are printed. |

## Remaining risks

- No invite flow or organization switcher endpoint yet.
- No ownership transfer or billing-level authorization.
- API-key middleware is present but not integrated with ingestion routes.
- Static AWS credentials and notification configs still need encryption or a secret manager.
- Tests are mostly unit/controller-level; disposable database integration tests are still needed.
- CI/CD is still missing.

## Phase 3 recommendations

- Add organization invite/member-management endpoints.
- Add API-key-authenticated ingestion endpoints for metrics/logs/health checks.
- Add integration tests using a disposable MySQL database.
- Encrypt stored integration secrets.
- Add CI for lint, tests, Prisma validation, and migration checks.
