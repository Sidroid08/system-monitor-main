import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
process.env.TELEMETRY_MAX_ACCEPTED_LOGS_PER_REQUEST = '1';
process.env.TELEMETRY_MAX_ACCEPTED_METRICS_PER_REQUEST = '1';

const {
  apiKeyRateLimitKey,
  authRateLimitKey,
  createRateLimiter,
  resetRateLimitStoresForTests,
  userRateLimitKey,
} = await import('../src/middleware/rateLimit.js');
const { makeIngestController } = await import('../src/modules/ingest/ingest.controller.js');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeReq(overrides = {}) {
  return {
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' },
    body: {},
    ...overrides,
  };
}

async function runLimiter(limiter, req) {
  const res = makeRes();
  let nextCalls = 0;
  await limiter(req, res, () => { nextCalls += 1; });
  return { res, nextCalls };
}

test('auth route limiter uses IP key and returns safe 429', async () => {
  resetRateLimitStoresForTests();
  const limiter = createRateLimiter({
    name: 'auth-test',
    windowSeconds: 60,
    max: 1,
    keyGenerator: authRateLimitKey,
    enabled: true,
  });

  const req = makeReq({ ip: '198.51.100.1' });
  const first = await runLimiter(limiter, req);
  const second = await runLimiter(limiter, req);

  assert.equal(first.nextCalls, 1);
  assert.equal(second.nextCalls, 0);
  assert.equal(second.res.statusCode, 429);
  assert.equal(second.res.body.success, false);
  assert.equal(second.res.body.message, 'Too many requests');
  assert.ok(second.res.headers['Retry-After']);
});

test('ingestion limiter uses API key and organization when available', async () => {
  resetRateLimitStoresForTests();
  const limiter = createRateLimiter({
    name: 'ingest-test',
    windowSeconds: 60,
    max: 1,
    keyGenerator: apiKeyRateLimitKey,
    enabled: true,
  });

  const req = makeReq({
    apiKey: { id: 'key-1', organizationId: 'org-1' },
    ip: '198.51.100.2',
  });

  const first = await runLimiter(limiter, req);
  const second = await runLimiter(limiter, req);

  assert.equal(first.nextCalls, 1);
  assert.equal(second.res.statusCode, 429);
});

test('query limiter uses user and organization when available', async () => {
  resetRateLimitStoresForTests();
  const limiter = createRateLimiter({
    name: 'query-test',
    windowSeconds: 60,
    max: 1,
    keyGenerator: userRateLimitKey,
    enabled: true,
  });

  const req = makeReq({
    user: { id: 'user-1', organizationId: 'org-1' },
    ip: '198.51.100.3',
  });

  const first = await runLimiter(limiter, req);
  const second = await runLimiter(limiter, req);

  assert.equal(first.nextCalls, 1);
  assert.equal(second.res.statusCode, 429);
});

test('disabled rate limiter bypasses requests', async () => {
  resetRateLimitStoresForTests();
  const limiter = createRateLimiter({
    name: 'disabled-test',
    windowSeconds: 60,
    max: 1,
    keyGenerator: authRateLimitKey,
    enabled: false,
  });

  const req = makeReq({ ip: '198.51.100.4' });
  const first = await runLimiter(limiter, req);
  const second = await runLimiter(limiter, req);

  assert.equal(first.nextCalls, 1);
  assert.equal(second.nextCalls, 1);
  assert.equal(second.res.statusCode, null);
});

test('log ingestion request quota caps accepted rows without failing batch', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (rows) => inserted.push(...rows),
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeReq({
    apiKey: { id: 'key-1', organizationId: 'org-1' },
    body: { logs: [{ message: 'one' }, { message: 'two' }] },
  });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(res.statusCode, 207);
  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 1);
  assert.equal(res.body.errors[0].reason, 'log request quota exceeded');
  assert.equal(inserted.length, 1);
});

test('metric ingestion request quota caps accepted rows without failing batch', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertMetricBatch: async (rows) => inserted.push(...rows),
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeReq({
    apiKey: { id: 'key-1', organizationId: 'org-1' },
    body: { metrics: [{ name: 'metric_one', value: 1 }, { name: 'metric_two', value: 2 }] },
  });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.statusCode, 207);
  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 1);
  assert.equal(res.body.errors[0].reason, 'metric request quota exceeded');
  assert.equal(inserted.length, 1);
});
