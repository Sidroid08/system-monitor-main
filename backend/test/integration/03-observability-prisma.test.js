import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { getLogStats } from '../../src/modules/logs/logs.repository.js';
import { aggregateMetrics } from '../../src/modules/metrics/metrics.repository.js';
import { getOverview } from '../../src/modules/observability/observability.repository.js';

const enabled = process.env.RUN_INTEGRATION_TESTS === 'true';

async function createOrg(prisma, name) {
  const id = randomUUID();
  return prisma.organization.create({
    data: { id, name, slug: `${name.toLowerCase()}-${id.slice(0, 8)}` },
  });
}

async function createService(prisma, organizationId) {
  return prisma.monitoredService.create({
    data: {
      id: randomUUID(),
      organizationId,
      name: 'Integration API',
      slug: `integration-api-${randomUUID().slice(0, 8)}`,
      type: 'HTTP',
      environment: 'test',
      url: 'https://example.com/health',
      currentStatus: 'UP',
    },
  });
}

test('observability raw aggregations work against MySQL and stay org scoped', { skip: enabled ? false : 'set RUN_INTEGRATION_TESTS=true' }, async () => {
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');

  const prisma = new PrismaClient();
  const orgA = await createOrg(prisma, 'ObsIntegrationA');
  const orgB = await createOrg(prisma, 'ObsIntegrationB');
  const serviceA = await createService(prisma, orgA.id);

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    const to = new Date(now.getTime() + 60 * 1000);

    await prisma.logEntry.createMany({
      data: [
        {
          id: randomUUID(),
          organizationId: orgA.id,
          serviceId: serviceA.id,
          level: 'ERROR',
          message: 'service failed',
          timestamp: now,
          ingestionSource: 'API_KEY',
        },
        {
          id: randomUUID(),
          organizationId: orgB.id,
          level: 'ERROR',
          message: 'other org failed',
          timestamp: now,
          ingestionSource: 'API_KEY',
        },
      ],
    });

    await prisma.metricSample.createMany({
      data: [
        {
          id: randomUUID(),
          organizationId: orgA.id,
          serviceId: serviceA.id,
          name: 'integration_latency_ms',
          type: 'GAUGE',
          value: 100,
          timestamp: now,
          ingestionSource: 'API_KEY',
        },
        {
          id: randomUUID(),
          organizationId: orgA.id,
          serviceId: serviceA.id,
          name: 'integration_latency_ms',
          type: 'GAUGE',
          value: 200,
          timestamp: now,
          ingestionSource: 'API_KEY',
        },
        {
          id: randomUUID(),
          organizationId: orgB.id,
          name: 'integration_latency_ms',
          type: 'GAUGE',
          value: 999,
          timestamp: now,
          ingestionSource: 'API_KEY',
        },
      ],
    });

    await prisma.uptimeCheck.create({
      data: {
        id: randomUUID(),
        organizationId: orgA.id,
        serviceId: serviceA.id,
        status: 'UP',
        responseTimeMs: 123,
        checkedAt: now,
      },
    });

    const metricRows = await aggregateMetrics(orgA.id, {
      serviceId: serviceA.id,
      name: 'integration_latency_ms',
      from,
      to,
      bucketSeconds: 300,
      aggregation: 'avg',
      groupBy: ['serviceId', 'name'],
    });
    const logStats = await getLogStats(orgA.id, {
      serviceId: serviceA.id,
      from,
      to,
      bucketSeconds: 300,
    });
    const overview = await getOverview(orgA.id, { from, to });

    assert.equal(metricRows.length, 1);
    assert.equal(metricRows[0].value, 150);
    assert.equal(metricRows[0].sampleCount, 2);
    assert.equal(logStats.errorCount, 1);
    assert.equal(logStats.totalsByLevel.ERROR, 1);
    assert.equal(overview.services.total, 1);
    assert.equal(overview.metrics.samples, 2);
  } finally {
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
    await prisma.$disconnect();
  }
});
