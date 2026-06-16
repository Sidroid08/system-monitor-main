import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { handleUptimeStateChange } = await import('../src/lib/uptimeAlerts.js');

function svc(overrides = {}) {
  return {
    id: 'service-1',
    organizationId: 'org-a',
    name: 'Public API',
    slug: 'public-api',
    type: 'HTTP',
    url: 'https://example.com',
    currentStatus: 'UP',
    ...overrides,
  };
}

function check(status, errorMessage = null) {
  return { status, errorMessage };
}

function makeDeps({ hasOpenResult = false } = {}) {
  const calls = { create: [], resolve: [], dispatch: [] };
  return {
    calls,
    deps: {
      createAlertFn: async (data) => {
        calls.create.push(data);
        return { ...data, id: 'alert-1', triggeredAt: new Date() };
      },
      resolveAlerts: async (orgId, serviceId) => {
        calls.resolve.push({ orgId, serviceId });
        return { count: 1 };
      },
      hasOpen: async () => hasOpenResult,
      dispatch: async (alert) => {
        calls.dispatch.push(alert);
      },
    },
  };
}

// ─── No-op cases ─────────────────────────────────────────────────────────────

test('no-op when status unchanged UP → UP', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP' }), check: check('UP') }, deps);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.resolve.length, 0);
});

test('no-op when status unchanged DOWN → DOWN', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('DOWN') }, deps);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.resolve.length, 0);
});

test('no-op when status unchanged DEGRADED → DEGRADED', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DEGRADED' }), check: check('DEGRADED') }, deps);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.resolve.length, 0);
});

test('no-op when UNKNOWN → UP (nothing to resolve, not a downstate)', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UNKNOWN' }), check: check('UP') }, deps);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.resolve.length, 0);
});

// ─── Alert creation ───────────────────────────────────────────────────────────

test('creates HIGH alert and dispatches when UP → DOWN', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP' }), check: check('DOWN', 'Connection refused') }, deps);
  // dispatch runs inside setImmediate — drain the queue before asserting
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(calls.create.length, 1);
  const alert = calls.create[0];
  assert.equal(alert.organizationId, 'org-a');
  assert.equal(alert.severity, 'HIGH');
  assert.equal(alert.source, 'uptime-check');
  assert.equal(alert.status, 'OPEN');
  assert.match(alert.title, /service-1|Public API/i);
  assert.match(alert.description, /Connection refused/);
  assert.ok(alert.labels.includes('"serviceId":"service-1"'));
  assert.equal(calls.dispatch.length, 1);
});

test('creates MEDIUM alert when UP → DEGRADED', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP' }), check: check('DEGRADED') }, deps);

  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0].severity, 'MEDIUM');
});

test('creates alert when UNKNOWN → DOWN (first-time down check)', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UNKNOWN' }), check: check('DOWN') }, deps);
  assert.equal(calls.create.length, 1);
});

test('labels include serviceId, serviceName, serviceSlug, and type', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP' }), check: check('DOWN') }, deps);

  const labels = JSON.parse(calls.create[0].labels);
  assert.equal(labels.serviceId, 'service-1');
  assert.equal(labels.serviceName, 'Public API');
  assert.equal(labels.serviceSlug, 'public-api');
  assert.equal(labels.type, 'HTTP');
});

test('uses service URL as metricName when available', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP', url: 'https://api.example.com' }), check: check('DOWN') }, deps);
  assert.equal(calls.create[0].metricName, 'https://api.example.com');
});

test('metricName is null when service has no URL', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP', url: null }), check: check('DOWN') }, deps);
  assert.equal(calls.create[0].metricName, null);
});

// ─── Deduplication ───────────────────────────────────────────────────────────

test('does not create duplicate alert when an open alert already exists', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: true });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP' }), check: check('DOWN') }, deps);
  assert.equal(calls.create.length, 0);
  assert.equal(calls.dispatch.length, 0);
});

test('dedup check is skipped entirely when new status is UP (recovery path)', async () => {
  const hasOpenCalls = [];
  const { calls, deps } = makeDeps();
  deps.hasOpen = async (...args) => { hasOpenCalls.push(args); return false; };

  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('UP') }, deps);
  assert.equal(hasOpenCalls.length, 0);
  assert.equal(calls.create.length, 0);
});

// ─── Alert resolution ────────────────────────────────────────────────────────

test('resolves open alerts when DOWN → UP', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('UP') }, deps);

  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.resolve[0].orgId, 'org-a');
  assert.equal(calls.resolve[0].serviceId, 'service-1');
  assert.equal(calls.create.length, 0);
});

test('resolves open alerts when DEGRADED → UP', async () => {
  const { calls, deps } = makeDeps();
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DEGRADED' }), check: check('UP') }, deps);

  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.create.length, 0);
});

test('does not resolve when transitioning between DOWN states (DOWN → DEGRADED)', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: true });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('DEGRADED') }, deps);
  assert.equal(calls.resolve.length, 0);
});

test('currentStatus defaults to UNKNOWN when missing from service object', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  const serviceWithoutStatus = { id: 'service-2', organizationId: 'org-a', name: 'X', slug: 'x', type: 'HTTP', url: null };
  await handleUptimeStateChange({ service: serviceWithoutStatus, check: check('DOWN') }, deps);
  assert.equal(calls.create.length, 1);
});
