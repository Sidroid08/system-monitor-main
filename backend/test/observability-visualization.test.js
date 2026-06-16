import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { makeObservabilityController } = await import('../src/modules/observability/observability.controller.js');
const { serviceSummaryQuerySchema } = await import('../src/modules/observability/observability.schemas.js');
const { makeMetricsController } = await import('../src/modules/metrics/metrics.controller.js');
const { aggregateMetricsQuerySchema } = await import('../src/modules/metrics/metrics.schemas.js');
const { makeLogsController } = await import('../src/modules/logs/logs.controller.js');
const { logStatsQuerySchema } = await import('../src/modules/logs/logs.schemas.js');
const { range: vmRange } = await import('../src/modules/query/query.controller.js');

const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ORG_B = 'bbbbbbbb-0000-4000-8000-000000000001';
const SERVICE_ID = 'dddddddd-0000-4000-8000-000000000001';

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeReq({ query = {}, params = {}, orgId = ORG_A, role = 'VIEWER' } = {}) {
  return {
    user: { id: 'user-1', organizationId: orgId, role },
    query,
    params,
    body: {},
  };
}

test('overview API passes authenticated organization scope to repository', async () => {
  let capturedOrgId;
  const repo = {
    getOverview: async (organizationId, window) => {
      capturedOrgId = organizationId;
      assert.ok(window.from instanceof Date);
      assert.ok(window.to instanceof Date);
      return {
        services: { total: 1, byStatus: { UP: 1, DOWN: 0, DEGRADED: 0, UNKNOWN: 0 } },
        alerts: { active: 0, recent: [] },
        incidents: { open: 0, recent: [] },
        uptime: { percentage: 100, totalChecks: 4, byStatus: { UP: 4 } },
        responseTime: { averageMs: 123 },
        logs: { byLevel: { ERROR: 0 } },
        metrics: { samples: 2 },
      };
    },
  };
  const { overview } = makeObservabilityController({ repo });
  const res = makeRes();

  await overview(makeReq({ orgId: ORG_B }), res);

  assert.equal(capturedOrgId, ORG_B);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.services.total, 1);
});

test('service summary API returns same-org service dashboard payload', async () => {
  let captured;
  const repo = {
    getServiceSummary: async (organizationId, serviceId, opts) => {
      captured = { organizationId, serviceId, opts };
      return {
        service: { id: serviceId, name: 'API', currentStatus: 'UP' },
        latestUptimeCheck: { id: 'check-1', status: 'UP' },
        uptime: { last24h: { percentage: 100 }, last7d: { percentage: 99.5 } },
        responseTimeSeries: [],
        statusHistory: [],
        logs: { byLevel: {}, recent: [] },
        alerts: { recent: [] },
        incidents: { recent: [] },
      };
    },
  };
  const { serviceSummary } = makeObservabilityController({ repo });
  const res = makeRes();

  await serviceSummary(makeReq({
    params: { serviceId: SERVICE_ID },
    query: { range: '24h', bucket: '15m' },
  }), res);

  assert.equal(captured.organizationId, ORG_A);
  assert.equal(captured.serviceId, SERVICE_ID);
  assert.equal(captured.opts.bucketSeconds, 900);
  assert.equal(res.body.data.service.id, SERVICE_ID);
  assert.equal(res.body.data.window.bucket, '15m');
});

test('service summary API rejects cross-org or missing service', async () => {
  const repo = { getServiceSummary: async () => null };
  const { serviceSummary } = makeObservabilityController({ repo });

  await assert.rejects(
    () => serviceSummary(makeReq({ params: { serviceId: SERVICE_ID } }), makeRes()),
    { message: 'Service not found' },
  );
});

test('service summary validation rejects unsupported ranges and excessive buckets', async () => {
  assert.equal(serviceSummaryQuerySchema.safeParse({ range: '90d' }).success, false);

  const repo = { getServiceSummary: async () => ({ service: { id: SERVICE_ID } }) };
  const { serviceSummary } = makeObservabilityController({ repo });

  await assert.rejects(
    () => serviceSummary(makeReq({
      params: { serviceId: SERVICE_ID },
      query: { range: '30d', bucket: '1m' },
    }), makeRes()),
    { message: /more than 500 buckets/ },
  );
});

test('VictoriaMetrics health route reports healthy and unhealthy states without external calls', async () => {
  const healthyController = makeObservabilityController({
    repo: {},
    vmHealthCheck: async () => true,
  });
  const healthyRes = makeRes();
  await healthyController.victoriaMetricsHealth(makeReq(), healthyRes);
  assert.equal(healthyRes.statusCode, 200);
  assert.equal(healthyRes.body.data.status, 'healthy');

  const unhealthyController = makeObservabilityController({
    repo: {},
    vmHealthCheck: async () => false,
  });
  const unhealthyRes = makeRes();
  await unhealthyController.victoriaMetricsHealth(makeReq(), unhealthyRes);
  assert.equal(unhealthyRes.statusCode, 503);
  assert.equal(unhealthyRes.body.success, false);
});

test('metric aggregation schema rejects invalid bucket and aggregation', () => {
  assert.equal(aggregateMetricsQuerySchema.safeParse({ bucket: '2m' }).success, false);
  assert.equal(aggregateMetricsQuerySchema.safeParse({ aggregation: 'p95' }).success, false);
});

test('metric aggregation scopes service validation and query to organization', async () => {
  const calls = [];
  const repo = {
    serviceExistsInOrg: async (organizationId, serviceId) => {
      calls.push({ type: 'serviceExistsInOrg', organizationId, serviceId });
      return true;
    },
    aggregateMetrics: async (organizationId, opts) => {
      calls.push({ type: 'aggregateMetrics', organizationId, opts });
      return [{ bucketStart: '2026-06-16T00:00:00.000Z', value: 4, sampleCount: 2 }];
    },
  };
  const { aggregateMetrics } = makeMetricsController({ repo });
  const res = makeRes();

  await aggregateMetrics(makeReq({
    orgId: ORG_B,
    query: {
      serviceId: SERVICE_ID,
      name: 'checkout_latency_ms',
      range: '1h',
      bucket: '5m',
      aggregation: 'avg',
      groupBy: 'serviceId,name',
    },
  }), res);

  assert.equal(calls[0].organizationId, ORG_B);
  assert.equal(calls[0].serviceId, SERVICE_ID);
  assert.equal(calls[1].organizationId, ORG_B);
  assert.deepEqual(calls[1].opts.groupBy, ['serviceId', 'name']);
  assert.equal(res.body.meta.bucket, '5m');
});

test('metric aggregation rejects cross-org service filter', async () => {
  const repo = {
    serviceExistsInOrg: async () => false,
    aggregateMetrics: async () => [],
  };
  const { aggregateMetrics } = makeMetricsController({ repo });

  await assert.rejects(
    () => aggregateMetrics(makeReq({ query: { serviceId: SERVICE_ID } }), makeRes()),
    { message: 'Service not found' },
  );
});

test('metric aggregation enforces max bucket protection', async () => {
  const repo = {
    serviceExistsInOrg: async () => true,
    aggregateMetrics: async () => [],
  };
  const { aggregateMetrics } = makeMetricsController({ repo });

  await assert.rejects(
    () => aggregateMetrics(makeReq({ query: { range: '30d', bucket: '1m' } }), makeRes()),
    { message: /more than 500 buckets/ },
  );
});

test('log stats schema rejects invalid bucket', () => {
  assert.equal(logStatsQuerySchema.safeParse({ bucket: '2m' }).success, false);
});

test('log stats API returns counts and scopes service filter to organization', async () => {
  const calls = [];
  const repo = {
    serviceExistsInOrg: async (organizationId, serviceId) => {
      calls.push({ type: 'serviceExistsInOrg', organizationId, serviceId });
      return true;
    },
    getLogStats: async (organizationId, opts) => {
      calls.push({ type: 'getLogStats', organizationId, opts });
      return {
        series: [{ bucketStart: '2026-06-16T00:00:00.000Z', level: 'ERROR', count: 2 }],
        totalsByLevel: { ERROR: 2, FATAL: 1 },
        topServices: [{ serviceId: SERVICE_ID, count: 3 }],
        errorCount: 3,
      };
    },
  };
  const { getLogStats } = makeLogsController({ repo });
  const res = makeRes();

  await getLogStats(makeReq({
    orgId: ORG_B,
    query: { serviceId: SERVICE_ID, range: '24h', bucket: '1h', level: 'ERROR' },
  }), res);

  assert.equal(calls[0].organizationId, ORG_B);
  assert.equal(calls[1].organizationId, ORG_B);
  assert.equal(calls[1].opts.level, 'ERROR');
  assert.equal(res.body.data.errorCount, 3);
  assert.equal(res.body.meta.bucket, '1h');
});

test('log stats API rejects cross-org service filter', async () => {
  const repo = {
    serviceExistsInOrg: async () => false,
    getLogStats: async () => ({}),
  };
  const { getLogStats } = makeLogsController({ repo });

  await assert.rejects(
    () => getLogStats(makeReq({ query: { serviceId: SERVICE_ID } }), makeRes()),
    { message: 'Service not found' },
  );
});

test('VictoriaMetrics range query rejects excessive bucket counts before network access', async () => {
  await assert.rejects(
    () => vmRange(makeReq({
      query: {
        query: 'up',
        start: '2026-01-01T00:00:00.000Z',
        end: '2026-01-31T00:00:00.000Z',
        step: '1m',
      },
    }), makeRes()),
    { message: /more than 500 buckets/ },
  );
});
