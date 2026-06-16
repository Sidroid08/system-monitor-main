import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { listLogsQuerySchema } = await import('../src/modules/logs/logs.schemas.js');
const { listMetricsQuerySchema, listMetricNamesQuerySchema } = await import('../src/modules/metrics/metrics.schemas.js');
const { makeLogsController }    = await import('../src/modules/logs/logs.controller.js');
const { makeMetricsController } = await import('../src/modules/metrics/metrics.controller.js');

// ─── UUIDs ────────────────────────────────────────────────────────────────────

const ORG_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORG_B = 'bbbbbbbb-0000-0000-0000-000000000001';
const SVC_1 = 'dddddddd-0000-0000-0000-000000000001';
const LOG_1 = 'ffffffff-0000-0000-0000-000000000001';
const MET_1 = 'ffffffff-0000-0000-0000-000000000002';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeJwtReq({ query = {}, params = {}, orgId = ORG_A, role = 'VIEWER' } = {}) {
  return { user: { id: 'user-1', organizationId: orgId, role }, query, params };
}

function makeLogEntry(overrides = {}) {
  return {
    id: LOG_1,
    organizationId: ORG_A,
    serviceId: null,
    level: 'INFO',
    message: 'Test log',
    timestamp: new Date(),
    source: null,
    environment: 'production',
    traceId: null,
    spanId: null,
    requestId: null,
    attributes: null,
    ingestionSource: 'API_KEY',
    receivedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

function makeMetricSample(overrides = {}) {
  return {
    id: MET_1,
    organizationId: ORG_A,
    serviceId: null,
    name: 'cpu_usage',
    type: 'GAUGE',
    value: 0.75,
    unit: null,
    timestamp: new Date(),
    tags: null,
    ingestionSource: 'API_KEY',
    receivedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Log query schema tests ───────────────────────────────────────────────────

test('listLogsQuerySchema — no params defaults limit to 50', () => {
  const result = listLogsQuerySchema.safeParse({});
  assert.ok(result.success);
  assert.equal(result.data.limit, 50);
});

test('listLogsQuerySchema — valid params', () => {
  const result = listLogsQuerySchema.safeParse({
    serviceId: SVC_1,
    level: 'ERROR',
    environment: 'production',
    traceId: 'trace-abc',
    from: new Date().toISOString(),
    to: new Date().toISOString(),
    search: 'something failed',
    limit: '100',
  });
  assert.ok(result.success);
  assert.equal(result.data.limit, 100);
  assert.equal(result.data.level, 'ERROR');
});

test('listLogsQuerySchema — rejects invalid level', () => {
  const result = listLogsQuerySchema.safeParse({ level: 'VERBOSE' });
  assert.ok(!result.success);
});

test('listLogsQuerySchema — rejects invalid serviceId', () => {
  const result = listLogsQuerySchema.safeParse({ serviceId: 'not-a-uuid' });
  assert.ok(!result.success);
});

test('listLogsQuerySchema — coerces limit from string', () => {
  const result = listLogsQuerySchema.safeParse({ limit: '200' });
  assert.ok(result.success);
  assert.equal(result.data.limit, 200);
});

test('listLogsQuerySchema — rejects limit > 500', () => {
  const result = listLogsQuerySchema.safeParse({ limit: '501' });
  assert.ok(!result.success);
});

// ─── Metric query schema tests ────────────────────────────────────────────────

test('listMetricsQuerySchema — defaults limit to 50', () => {
  const result = listMetricsQuerySchema.safeParse({});
  assert.ok(result.success);
  assert.equal(result.data.limit, 50);
});

test('listMetricsQuerySchema — valid params', () => {
  const result = listMetricsQuerySchema.safeParse({
    serviceId: SVC_1,
    name: 'cpu_usage',
    type: 'COUNTER',
    limit: '20',
  });
  assert.ok(result.success);
  assert.equal(result.data.type, 'COUNTER');
});

test('listMetricsQuerySchema — rejects invalid type', () => {
  const result = listMetricsQuerySchema.safeParse({ type: 'SUMMARY' });
  assert.ok(!result.success);
});

test('listMetricNamesQuerySchema — optional prefix', () => {
  const result = listMetricNamesQuerySchema.safeParse({ prefix: 'http_' });
  assert.ok(result.success);
  assert.equal(result.data.prefix, 'http_');
});

test('listMetricNamesQuerySchema — empty params valid', () => {
  const result = listMetricNamesQuerySchema.safeParse({});
  assert.ok(result.success);
});

// ─── Logs controller: listLogs ────────────────────────────────────────────────

test('listLogs — returns rows and nextCursor', async () => {
  const entry = makeLogEntry();
  const repo = {
    listLogs: async () => ({ rows: [entry], nextCursor: null }),
    findLogById: async () => entry,
  };
  const { listLogs } = makeLogsController({ repo });
  const req = makeJwtReq({ query: {} });
  const res = makeRes();

  await listLogs(req, res);

  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.nextCursor, null);
});

test('listLogs — passes filters to repo', async () => {
  let capturedOpts;
  const repo = {
    listLogs: async (orgId, opts) => { capturedOpts = opts; return { rows: [], nextCursor: null }; },
  };
  const { listLogs } = makeLogsController({ repo });
  const req = makeJwtReq({ query: { level: 'ERROR', limit: '25' } });
  const res = makeRes();

  await listLogs(req, res);

  assert.equal(capturedOpts.level, 'ERROR');
  assert.equal(capturedOpts.limit, 25);
});

test('listLogs — invalid query returns 400', async () => {
  const { listLogs } = makeLogsController({ repo: {} });
  const req = makeJwtReq({ query: { level: 'VERBOSE' } });
  const res = makeRes();

  await listLogs(req, res);

  assert.equal(res.statusCode, 400);
});

test('listLogs — uses organizationId from JWT', async () => {
  let capturedOrgId;
  const repo = {
    listLogs: async (orgId, opts) => { capturedOrgId = orgId; return { rows: [], nextCursor: null }; },
  };
  const { listLogs } = makeLogsController({ repo });
  const req = makeJwtReq({ orgId: ORG_B });
  const res = makeRes();

  await listLogs(req, res);

  assert.equal(capturedOrgId, ORG_B);
});

test('listLogs — pagination cursor forwarded', async () => {
  let capturedOpts;
  const repo = {
    listLogs: async (orgId, opts) => { capturedOpts = opts; return { rows: [], nextCursor: null }; },
  };
  const { listLogs } = makeLogsController({ repo });
  const req = makeJwtReq({ query: { cursor: 'some-cursor-id' } });
  const res = makeRes();

  await listLogs(req, res);

  assert.equal(capturedOpts.cursor, 'some-cursor-id');
});

// ─── Logs controller: getLog ──────────────────────────────────────────────────

test('getLog — returns entry when found', async () => {
  const entry = makeLogEntry();
  const repo = {
    findLogById: async (id, orgId) => id === LOG_1 && orgId === ORG_A ? entry : null,
  };
  const { getLog } = makeLogsController({ repo });
  const req = makeJwtReq({ params: { id: LOG_1 } });
  const res = makeRes();

  await getLog(req, res);

  assert.equal(res.body.id, LOG_1);
});

test('getLog — returns 404 when not found', async () => {
  const repo = { findLogById: async () => null };
  const { getLog } = makeLogsController({ repo });
  const req = makeJwtReq({ params: { id: 'missing-id' } });
  const res = makeRes();

  await getLog(req, res);

  assert.equal(res.statusCode, 404);
});

test('getLog — tenant isolation: not found in other org', async () => {
  const entry = makeLogEntry({ organizationId: ORG_A });
  const repo = {
    findLogById: async (id, orgId) => orgId === ORG_A ? entry : null,
  };
  const { getLog } = makeLogsController({ repo });
  const req = makeJwtReq({ params: { id: LOG_1 }, orgId: ORG_B });
  const res = makeRes();

  await getLog(req, res);

  assert.equal(res.statusCode, 404);
});

// ─── Metrics controller: listMetrics ─────────────────────────────────────────

test('listMetrics — returns rows and nextCursor', async () => {
  const sample = makeMetricSample();
  const repo = {
    listMetrics: async () => ({ rows: [sample], nextCursor: null }),
    listMetricNames: async () => [],
  };
  const { listMetrics } = makeMetricsController({ repo });
  const req = makeJwtReq({ query: {} });
  const res = makeRes();

  await listMetrics(req, res);

  assert.equal(res.body.data.length, 1);
  assert.equal(res.body.nextCursor, null);
});

test('listMetrics — passes filters to repo', async () => {
  let capturedOpts;
  const repo = {
    listMetrics: async (orgId, opts) => { capturedOpts = opts; return { rows: [], nextCursor: null }; },
  };
  const { listMetrics } = makeMetricsController({ repo });
  const req = makeJwtReq({ query: { name: 'cpu_usage', type: 'GAUGE', limit: '10' } });
  const res = makeRes();

  await listMetrics(req, res);

  assert.equal(capturedOpts.name, 'cpu_usage');
  assert.equal(capturedOpts.type, 'GAUGE');
  assert.equal(capturedOpts.limit, 10);
});

test('listMetrics — invalid query returns 400', async () => {
  const { listMetrics } = makeMetricsController({ repo: {} });
  const req = makeJwtReq({ query: { type: 'INVALID' } });
  const res = makeRes();

  await listMetrics(req, res);

  assert.equal(res.statusCode, 400);
});

test('listMetrics — tenant isolation via JWT org', async () => {
  let capturedOrgId;
  const repo = {
    listMetrics: async (orgId) => { capturedOrgId = orgId; return { rows: [], nextCursor: null }; },
  };
  const { listMetrics } = makeMetricsController({ repo });
  const req = makeJwtReq({ orgId: ORG_B });
  const res = makeRes();

  await listMetrics(req, res);

  assert.equal(capturedOrgId, ORG_B);
});

// ─── Metrics controller: listMetricNames ─────────────────────────────────────

test('listMetricNames — returns array of name strings', async () => {
  const repo = {
    listMetricNames: async () => ['cpu_usage', 'mem_usage', 'disk_io'],
  };
  const { listMetricNames } = makeMetricsController({ repo });
  const req = makeJwtReq({ query: {} });
  const res = makeRes();

  await listMetricNames(req, res);

  assert.deepEqual(res.body.data, ['cpu_usage', 'mem_usage', 'disk_io']);
});

test('listMetricNames — prefix forwarded to repo', async () => {
  let capturedOpts;
  const repo = {
    listMetricNames: async (orgId, opts) => { capturedOpts = opts; return []; },
  };
  const { listMetricNames } = makeMetricsController({ repo });
  const req = makeJwtReq({ query: { prefix: 'http_' } });
  const res = makeRes();

  await listMetricNames(req, res);

  assert.equal(capturedOpts.prefix, 'http_');
});

test('listMetricNames — serviceId filter forwarded', async () => {
  let capturedOpts;
  const repo = {
    listMetricNames: async (orgId, opts) => { capturedOpts = opts; return []; },
  };
  const { listMetricNames } = makeMetricsController({ repo });
  const req = makeJwtReq({ query: { serviceId: SVC_1 } });
  const res = makeRes();

  await listMetricNames(req, res);

  assert.equal(capturedOpts.serviceId, SVC_1);
});

test('listMetricNames — invalid serviceId returns 400', async () => {
  const { listMetricNames } = makeMetricsController({ repo: {} });
  const req = makeJwtReq({ query: { serviceId: 'not-a-uuid' } });
  const res = makeRes();

  await listMetricNames(req, res);

  assert.equal(res.statusCode, 400);
});
