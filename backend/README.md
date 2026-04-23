# Sidroid Phase 1 Backend

Phase 1 control-plane backend for Sidroid. This backend provides:

- JWT-based auth
- organization management
- AWS account connection storage
- EC2 sync into MySQL
- instance inventory APIs

## Folder structure

```text
sidroid-phase1-backend/
├── package.json
├── .env.example
├── README.md
├── sql/
│   └── schema.sql
├── scripts/
│   └── manualSync.js
└── src/
    ├── app.js
    ├── server.js
    ├── config/
    │   └── env.js
    ├── db/
    │   └── pool.js
    ├── middleware/
    │   ├── authenticate.js
    │   └── errorHandler.js
    ├── modules/
    │   ├── auth/
    │   ├── organizations/
    │   ├── aws/
    │   └── instances/
    ├── services/
    │   └── awsSyncService.js
    └── utils/
        ├── apiResponse.js
        ├── asyncHandler.js
        └── orgCode.js
```

## Tech stack

- Node.js
- Express
- MySQL
- AWS SDK v3 for JavaScript
- JWT auth

## Quick start

1. Create a MySQL database and run `sql/schema.sql`.
2. Copy `.env.example` to `.env` and update values.
3. Install packages:

```bash
npm install
```

4. Start the server:

```bash
npm run dev
```

## Environment variables

See `.env.example`.

Important ones:

- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `AWS_SYNC_DEFAULT_REGION`

## API routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Organizations

- `GET /api/org`
- `POST /api/org`

### AWS

- `GET /api/aws`
- `POST /api/aws/connect`
- `POST /api/aws/sync`

### Instances

- `GET /api/instances`
- `GET /api/instances?orgId=1`

## Example request flow

### 1. Register

```json
{
  "name": "Siddhant",
  "email": "sid@example.com",
  "password": "StrongPass123"
}
```

### 2. Login

```json
{
  "email": "sid@example.com",
  "password": "StrongPass123"
}
```

### 3. Create organization

```json
{
  "name": "CompanyA",
  "description": "First customer org"
}
```

### 4. Connect AWS account

```json
{
  "organizationId": 1,
  "accountName": "company-a-prod",
  "region": "us-east-1",
  "authType": "access_key",
  "accessKeyId": "AKIA...",
  "secretAccessKey": "..."
}
```

### 5. Sync EC2 instances

```json
{
  "awsAccountId": 1
}
```

## AWS tag model expected by the sync

The sync filters for instances tagged with:

- `Monitor=true`

And it reads these tags when present:

- `Name`
- `Node`
- `Service`
- `OrgId`
- `OrgName`

## Notes

- Phase 1 stores AWS secrets directly in MySQL for development speed. For production, encrypt them or move to a secrets manager.
- IAM role-based auth is scaffolded in the schema but not fully implemented in the sync service yet.
- Config generation and Grafana automation are Phase 2/3 work.
