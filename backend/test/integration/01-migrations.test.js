import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Prisma, PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);
const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';

const REQUIRED_TABLES = [
  'incidents',
  'incident_events',
  'log_entries',
  'metric_samples',
  'uptime_alert_rules',
  'monitored_services',
  'uptime_checks',
];

const prismaCli = path.resolve(process.cwd(), 'node_modules/prisma/build/index.js');

test('migrations deploy and required Phase 6/7/8 tables exist', { skip: enabled ? false : 'set RUN_INTEGRATION_TESTS=true' }, async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');

  await execFileAsync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 5,
  });

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`
      SELECT TABLE_NAME AS tableName
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN (${Prisma.join(REQUIRED_TABLES)})
      ORDER BY TABLE_NAME
    `;
    const found = new Set(rows.map((row) => row.tableName ?? row.TABLE_NAME));
    for (const table of REQUIRED_TABLES) {
      assert.ok(found.has(table), `Expected table ${table} to exist`);
    }
  } finally {
    await prisma.$disconnect();
  }
});
