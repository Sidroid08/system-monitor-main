import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const {
  isValidMetricName,
  truncateMessage,
  redactAndLimitAttrs,
  parseTimestamp,
  truncateStr,
} = await import('../src/lib/telemetry.js');

const { logItemSchema, logBatchSchema, metricItemSchema, metricBatchSchema } =
  await import('../src/modules/ingest/ingest.schemas.js');

const { makeIngestController } = await import('../src/modules/ingest/ingest.controller.js');

// ─── UUIDs ────────────────────────────────────────────────────────────────────

const ORG_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const SVC_1 = 'dddddddd-0000-0000-0000-000000000001';
const SVC_X = 'dddddddd-0000-0000-0000-000000000099'; // not in org

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeApiKeyReq({ body = {}, orgId = ORG_A } = {}) {
  return { apiKey: { organizationId: orgId }, body };
}

function makeRepo({ svcExists = true, logInserted = null, metricInserted = null } = {}) {
  return {
    serviceExistsInOrg: async () => svcExists,
    insertLogBatch: async (records) => { logInserted = records; return { count: records.length }; },
    insertMetricBatch: async (records) => { metricInserted = records; return { count: records.length }; },
  };
}

// ─── telemetry.js utilities ───────────────────────────────────────────────────

test('isValidMetricName — valid names', () => {
  assert.ok(isValidMetricName('http_requests_total'));
  assert.ok(isValidMetricName('cpu_usage'));
  assert.ok(isValidMetricName(':colon_start'));
  assert.ok(isValidMetricName('_underscore'));
  assert.ok(isValidMetricName('metric.with.dots'));
  assert.ok(isValidMetricName('metric-with-hyphens'));
  assert.ok(isValidMetricName('a'.repeat(200)));
});

test('isValidMetricName — invalid names', () => {
  assert.equal(isValidMetricName('0starts_with_digit'), false);
  assert.equal(isValidMetricName('has space'), false);
  assert.equal(isValidMetricName(''), false);
  assert.equal(isValidMetricName(null), false);
  assert.equal(isValidMetricName('a'.repeat(201)), false);
});

test('truncateMessage — long message is truncated to 5000', () => {
  const long = 'x'.repeat(6000);
  assert.equal(truncateMessage(long).length, 5000);
});

test('truncateMessage — short message unchanged', () => {
  assert.equal(truncateMessage('hello'), 'hello');
});

test('truncateMessage — non-string coerced', () => {
  const result = truncateMessage(42);
  assert.equal(typeof result, 'string');
});

test('redactAndLimitAttrs — removes sensitive keys', () => {
  const result = redactAndLimitAttrs({
    password: 'secret123',
    token: 'tok',
    authorization: 'Bearer x',
    apikey: 'key',
    api_key: 'key',
    secret: 'shh',
    cookie: 'c=1',
    normal_key: 'value',
  });
  assert.ok(result);
  assert.ok(!('password' in result));
  assert.ok(!('token' in result));
  assert.ok(!('authorization' in result));
  assert.ok(!('apikey' in result));
  assert.ok(!('api_key' in result));
  assert.ok(!('secret' in result));
  assert.ok(!('cookie' in result));
  assert.equal(result.normal_key, 'value');
});

test('redactAndLimitAttrs — limits to 50 keys', () => {
  const attrs = {};
  for (let i = 0; i < 70; i++) attrs[`key_${i}`] = 'v';
  const result = redactAndLimitAttrs(attrs);
  assert.equal(Object.keys(result).length, 50);
});

test('redactAndLimitAttrs — truncates long values to 500', () => {
  const result = redactAndLimitAttrs({ k: 'a'.repeat(600) });
  assert.equal(result.k.length, 500);
});

test('redactAndLimitAttrs — null/undefined/array input returns undefined', () => {
  assert.equal(redactAndLimitAttrs(null), undefined);
  assert.equal(redactAndLimitAttrs(undefined), undefined);
  assert.equal(redactAndLimitAttrs([1, 2, 3]), undefined);
});

test('parseTimestamp — valid ISO string', () => {
  const d = new Date();
  d.setSeconds(d.getSeconds() - 10);
  const result = parseTimestamp(d.toISOString());
  assert.ok(result instanceof Date);
  assert.ok(Math.abs(result.getTime() - d.getTime()) < 1000);
});

test('parseTimestamp — undefined returns now (approx)', () => {
  const before = Date.now();
  const result = parseTimestamp(undefined);
  const after = Date.now();
  assert.ok(result.getTime() >= before - 10);
  assert.ok(result.getTime() <= after + 10);
});

test('parseTimestamp — future >24h returns now', () => {
  const far = new Date(Date.now() + 2 * 86_400_000).toISOString();
  const result = parseTimestamp(far);
  assert.ok(Date.now() - result.getTime() < 1000);
});

test('parseTimestamp — >30 days old returns now', () => {
  const old = new Date(Date.now() - 35 * 86_400_000).toISOString();
  const result = parseTimestamp(old);
  assert.ok(Date.now() - result.getTime() < 1000);
});

test('truncateStr — truncates to max', () => {
  assert.equal(truncateStr('abcdef', 3), 'abc');
});

test('truncateStr — returns undefined for empty result', () => {
  assert.equal(truncateStr('', 10), undefined);
});

// ─── Schema tests ─────────────────────────────────────────────────────────────

test('logItemSchema — minimal valid log', () => {
  const result = logItemSchema.safeParse({ message: 'hello' });
  assert.ok(result.success);
  assert.equal(result.data.level, 'INFO');
});

test('logItemSchema — valid with all fields', () => {
  const result = logItemSchema.safeParse({
    level: 'ERROR',
    message: 'Something went wrong',
    timestamp: new Date().toISOString(),
    source: 'api',
    environment: 'production',
    traceId: 'trace-abc',
    spanId: 'span-xyz',
    requestId: 'req-123',
    serviceId: SVC_1,
    attributes: { key: 'val' },
  });
  assert.ok(result.success);
});

test('logItemSchema — rejects empty message', () => {
  const result = logItemSchema.safeParse({ message: '' });
  assert.ok(!result.success);
});

test('logItemSchema — rejects invalid level', () => {
  const result = logItemSchema.safeParse({ message: 'x', level: 'VERBOSE' });
  assert.ok(!result.success);
});

test('logItemSchema — rejects invalid serviceId', () => {
  const result = logItemSchema.safeParse({ message: 'x', serviceId: 'not-a-uuid' });
  assert.ok(!result.success);
});

test('logBatchSchema — single item (no wrapper)', () => {
  const result = logBatchSchema.safeParse({ message: 'hi' });
  assert.ok(result.success);
});

test('logBatchSchema — batch of logs', () => {
  const result = logBatchSchema.safeParse({ logs: [{ message: 'a' }, { message: 'b' }] });
  assert.ok(result.success);
  assert.equal(result.data.logs.length, 2);
});

test('logBatchSchema — batch over 100 rejected', () => {
  const logs = Array.from({ length: 101 }, (_, i) => ({ message: `msg ${i}` }));
  const result = logBatchSchema.safeParse({ logs });
  assert.ok(!result.success);
});

test('metricItemSchema — minimal valid metric', () => {
  const result = metricItemSchema.safeParse({ name: 'cpu_usage', value: 0.42 });
  assert.ok(result.success);
  assert.equal(result.data.type, 'GAUGE');
});

test('metricItemSchema — valid with all fields', () => {
  const result = metricItemSchema.safeParse({
    name: 'http_requests_total',
    type: 'COUNTER',
    value: 1234,
    unit: 'requests',
    timestamp: new Date().toISOString(),
    serviceId: SVC_1,
    tags: { region: 'us-east-1' },
  });
  assert.ok(result.success);
});

test('metricItemSchema — rejects non-finite value', () => {
  const result = metricItemSchema.safeParse({ name: 'cpu', value: Infinity });
  assert.ok(!result.success);
});

test('metricItemSchema — rejects invalid type', () => {
  const result = metricItemSchema.safeParse({ name: 'cpu', value: 1, type: 'SUMMARY' });
  assert.ok(!result.success);
});

test('metricBatchSchema — batch of metrics', () => {
  const result = metricBatchSchema.safeParse({
    metrics: [
      { name: 'cpu_usage', value: 0.5 },
      { name: 'mem_usage', value: 0.7 },
    ],
  });
  assert.ok(result.success);
});

// ─── ingestLogs controller ────────────────────────────────────────────────────

test('ingestLogs — valid single log accepted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
    insertMetricBatch: async () => {},
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeApiKeyReq({ body: { message: 'test log', level: 'WARN' } });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(res.statusCode, 207);
  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 0);
  assert.equal(inserted.length, 1);
  assert.equal(inserted[0].level, 'WARN');
  assert.equal(inserted[0].message, 'test log');
  assert.equal(inserted[0].organizationId, ORG_A);
  assert.equal(inserted[0].ingestionSource, 'API_KEY');
});

test('ingestLogs — batch of logs, all accepted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: {
      logs: [
        { message: 'log 1' },
        { message: 'log 2', level: 'ERROR' },
        { message: 'log 3', serviceId: SVC_1 },
      ],
    },
  });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(res.body.accepted, 3);
  assert.equal(res.body.rejected, 0);
  assert.equal(inserted.length, 3);
});

test('ingestLogs — serviceId not in org is rejected', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async (svcId) => svcId !== SVC_X,
    insertLogBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: {
      logs: [
        { message: 'ok' },
        { message: 'bad service', serviceId: SVC_X },
      ],
    },
  });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 1);
  assert.equal(res.body.errors[0].index, 1);
});

test('ingestLogs — sensitive attributes are redacted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: { message: 'auth log', attributes: { token: 'secret-val', env: 'prod' } },
  });
  const res = makeRes();

  await ingestLogs(req, res);

  const attrs = inserted[0].attributes;
  assert.ok(!('token' in attrs));
  assert.equal(attrs.env, 'prod');
});

test('ingestLogs — message truncated at 5000 chars', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
  };
  const { ingestLogs } = makeIngestController({ repo });
  const req = makeApiKeyReq({ body: { message: 'x'.repeat(10_000) } });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(inserted[0].message.length, 5000);
});

test('ingestLogs — invalid payload returns 400', async () => {
  const { ingestLogs } = makeIngestController({ repo: makeRepo() });
  const req = makeApiKeyReq({ body: { message: '' } }); // empty message fails schema
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(res.statusCode, 400);
});

test('ingestLogs — tenant isolation: organizationId from apiKey', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertLogBatch: async (records) => { inserted.push(...records); },
  };
  const { ingestLogs } = makeIngestController({ repo });
  const OTHER_ORG = 'bbbbbbbb-0000-0000-0000-000000000099';
  const req = makeApiKeyReq({ body: { message: 'hello' }, orgId: OTHER_ORG });
  const res = makeRes();

  await ingestLogs(req, res);

  assert.equal(inserted[0].organizationId, OTHER_ORG);
});

// ─── ingestMetrics controller ─────────────────────────────────────────────────

test('ingestMetrics — valid single metric accepted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertMetricBatch: async (records) => { inserted.push(...records); return { count: records.length }; },
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeApiKeyReq({ body: { name: 'cpu_usage', value: 0.85 } });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.statusCode, 207);
  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 0);
  assert.equal(inserted[0].name, 'cpu_usage');
  assert.equal(inserted[0].value, 0.85);
  assert.equal(inserted[0].ingestionSource, 'API_KEY');
});

test('ingestMetrics — invalid metric name rejected', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertMetricBatch: async (records) => { inserted.push(...records); },
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: {
      metrics: [
        { name: 'valid_name', value: 1 },
        { name: '0invalid', value: 2 },
        { name: 'also valid', value: 3 }, // space makes it invalid
      ],
    },
  });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 2);
});

test('ingestMetrics — serviceId not in org rejected', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async (svcId) => svcId !== SVC_X,
    insertMetricBatch: async (records) => { inserted.push(...records); },
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: {
      metrics: [
        { name: 'cpu_usage', value: 1, serviceId: SVC_1 },
        { name: 'mem_usage', value: 2, serviceId: SVC_X },
      ],
    },
  });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.body.accepted, 1);
  assert.equal(res.body.rejected, 1);
});

test('ingestMetrics — sensitive tags redacted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertMetricBatch: async (records) => { inserted.push(...records); },
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: { name: 'my_metric', value: 1, tags: { secret: 'shh', region: 'eu' } },
  });
  const res = makeRes();

  await ingestMetrics(req, res);

  const tags = inserted[0].tags;
  assert.ok(!('secret' in tags));
  assert.equal(tags.region, 'eu');
});

test('ingestMetrics — invalid payload returns 400', async () => {
  const { ingestMetrics } = makeIngestController({ repo: makeRepo() });
  const req = makeApiKeyReq({ body: { name: 'cpu', value: 'not-a-number' } });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.statusCode, 400);
});

test('ingestMetrics — batch all valid accepted', async () => {
  const inserted = [];
  const repo = {
    serviceExistsInOrg: async () => true,
    insertMetricBatch: async (records) => { inserted.push(...records); },
  };
  const { ingestMetrics } = makeIngestController({ repo });
  const req = makeApiKeyReq({
    body: {
      metrics: [
        { name: 'a_metric', value: 1, type: 'GAUGE' },
        { name: 'b_metric', value: 2, type: 'COUNTER' },
        { name: 'c_metric', value: 3, type: 'HISTOGRAM' },
      ],
    },
  });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.body.accepted, 3);
  assert.equal(inserted.length, 3);
});

test('ingestMetrics — empty batch rejected by schema', async () => {
  const { ingestMetrics } = makeIngestController({ repo: makeRepo() });
  const req = makeApiKeyReq({ body: { metrics: [] } });
  const res = makeRes();

  await ingestMetrics(req, res);

  assert.equal(res.statusCode, 400);
});
