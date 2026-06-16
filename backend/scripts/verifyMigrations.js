import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Prisma, PrismaClient } from '@prisma/client';

const execFileAsync = promisify(execFile);

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

async function runPrisma(args) {
  const { stdout, stderr } = await execFileAsync(process.execPath, [prismaCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 5,
  });
  if (stdout.trim()) console.log(stdout.trim());
  if (stderr.trim()) console.error(stderr.trim());
}

async function verifyTables(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME IN (${Prisma.join(REQUIRED_TABLES)})
    ORDER BY TABLE_NAME
  `;
  const found = new Set(rows.map((row) => row.tableName ?? row.TABLE_NAME));
  const missing = REQUIRED_TABLES.filter((table) => !found.has(table));
  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(', ')}`);
  }
  console.log(`Required tables verified: ${REQUIRED_TABLES.join(', ')}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for migration verification');
  }

  await runPrisma(['migrate', 'deploy']);
  await runPrisma(['migrate', 'status']);

  const prisma = new PrismaClient();
  try {
    await verifyTables(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
