import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { insertLogBatch, insertMetricBatch } from '../../src/modules/ingest/ingest.repository.js';
import { listLogs } from '../../src/modules/logs/logs.repository.js';
import { listMetrics } from '../../src/modules/metrics/metrics.repository.js';

const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';

async function createOrg(prisma, name) {
  const id = randomUUID();
  return prisma.organization.create({
    data: { id, name, slug: `${name.toLowerCase()}-${id.slice(0, 8)}` },
  });
}

test('telemetry insert/query works and remains tenant scoped', { skip: enabled ? false : 'set RUN_INTEGRATION_TESTS=true' }, async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');

  const prisma = new PrismaClient();
  const orgA = await createOrg(prisma, 'IntegrationA');
  const orgB = await createOrg(prisma, 'IntegrationB');

  try {
    const now = new Date();
    await insertLogBatch([
      {
        id: randomUUID(),
        organizationId: orgA.id,
        level: 'ERROR',
        message: 'org A log',
        timestamp: now,
        ingestionSource: 'API_KEY',
      },
      {
        id: randomUUID(),
        organizationId: orgB.id,
        level: 'ERROR',
        message: 'org B log',
        timestamp: now,
        ingestionSource: 'API_KEY',
      },
    ]);

    await insertMetricBatch([
      {
        id: randomUUID(),
        organizationId: orgA.id,
        name: 'integration_metric',
        type: 'GAUGE',
        value: 10,
        timestamp: now,
        ingestionSource: 'API_KEY',
      },
      {
        id: randomUUID(),
        organizationId: orgB.id,
        name: 'integration_metric',
        type: 'GAUGE',
        value: 99,
        timestamp: now,
        ingestionSource: 'API_KEY',
      },
    ]);

    const logs = await listLogs(orgA.id, { limit: 10 });
    const metrics = await listMetrics(orgA.id, { name: 'integration_metric', limit: 10 });

    assert.equal(logs.rows.length, 1);
    assert.equal(logs.rows[0].organizationId, orgA.id);
    assert.equal(logs.rows[0].message, 'org A log');
    assert.equal(metrics.rows.length, 1);
    assert.equal(metrics.rows[0].organizationId, orgA.id);
    assert.equal(metrics.rows[0].value, 10);
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  }
});
