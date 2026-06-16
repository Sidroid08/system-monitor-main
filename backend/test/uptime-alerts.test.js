import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { handleUptimeStateChange, conditionMet } = await import('../src/lib/uptimeAlerts.js');

const UUID1 = '123e4567-e89b-12d3-a456-426614174000';

function svc(overrides = {}) {
  return {
    id: 'service-1',
    organizationId: 'org-a',
    name: 'Public API',
    slug: 'public-api',
    type: 'HTTP',
    url: 'https://example.com',
    currentStatus: 'UP',
    consecutiveFailures: 0,
    ...overrides,
  };
}

function check(status, extras = {}) {
  return { status, errorMessage: null, responseTimeMs: null, httpStatusCode: null, checkedAt: new Date(), ...extras };
}

// ─── Fallback-path helpers (no configured rules) ───────────────────────────────

function makeFallbackDeps({ hasOpenResult = false, openAlerts = [] } = {}) {
  const calls = { create: [], resolve: [], dispatch: [], auditLog: [] };
  return {
    calls,
    deps: {
      loadRules: async () => [],
      createAlertFn: async (data) => {
        const alert = { ...data, id: 'alert-1', triggeredAt: new Date() };
        calls.create.push(alert);
        return alert;
      },
      resolveAlertsAndReturn: async (orgId, serviceId) => {
        calls.resolve.push({ orgId, serviceId });
        return openAlerts;
      },
      hasOpen: async () => hasOpenResult,
      dispatch: async (alert) => { calls.dispatch.push(alert); },
      writeAuditLog: async (entry) => { calls.auditLog.push(entry); },
    },
  };
}

// Keep old alias for backward compat with unchanged tests.
const makeDeps = ({ hasOpenResult = false } = {}) => makeFallbackDeps({ hasOpenResult });

// ─── Rule-based helpers ────────────────────────────────────────────────────────

function makeRule(overrides = {}) {
  return {
    id: 'rule-1',
    organizationId: 'org-a',
    serviceId: null,
    name: 'Down Rule',
    type: 'SERVICE_DOWN',
    severity: 'HIGH',
    isActive: true,
    threshold: null,
    cooldownSeconds: 300,
    notificationChannelId: null,
    lastFiredAt: null,
    lastResolvedAt: null,
    ...overrides,
  };
}

function makeRuleDeps({ rules = [makeRule()], existingAlert = null, conditionFires = true } = {}) {
  const calls = { create: [], firedAt: [], resolvedAt: [], resolveById: [], dispatch: [], auditLog: [] };
  return {
    calls,
    deps: {
      loadRules: async () => rules,
      conditionMet: () => conditionFires,
      findOpenAlertForRuleFn: async () => existingAlert,
      createAlertFn: async (data) => {
        const alert = { ...data, id: 'alert-1', triggeredAt: new Date() };
        calls.create.push(alert);
        return alert;
      },
      resolveAlertByIdFn: async (id, orgId) => { calls.resolveById.push({ id, orgId }); return { count: 1 }; },
      updateRuleFiredAt: async (id) => { calls.firedAt.push(id); },
      updateRuleResolvedAt: async (id) => { calls.resolvedAt.push(id); },
      dispatch: async (alert) => { calls.dispatch.push(alert); },
      findChannelForDelivery: async () => null,
      writeAuditLog: async (entry) => { calls.auditLog.push(entry); },
    },
  };
}

// ─── conditionMet: pure function ─────────────────────────────────────────────

test('conditionMet SERVICE_DOWN fires only when status is DOWN', () => {
  const rule = { type: 'SERVICE_DOWN' };
  assert.equal(conditionMet(rule, {}, check('DOWN')), true);
  assert.equal(conditionMet(rule, {}, check('DEGRADED')), false);
  assert.equal(conditionMet(rule, {}, check('UP')), false);
});

test('conditionMet SERVICE_DEGRADED fires for DOWN and DEGRADED', () => {
  const rule = { type: 'SERVICE_DEGRADED' };
  assert.equal(conditionMet(rule, {}, check('DOWN')), true);
  assert.equal(conditionMet(rule, {}, check('DEGRADED')), true);
  assert.equal(conditionMet(rule, {}, check('UP')), false);
});

test('conditionMet RESPONSE_TIME_ABOVE fires when responseTimeMs strictly exceeds threshold', () => {
  const rule = { type: 'RESPONSE_TIME_ABOVE', threshold: 500 };
  assert.equal(conditionMet(rule, {}, check('UP', { responseTimeMs: 600 })), true);
  assert.equal(conditionMet(rule, {}, check('UP', { responseTimeMs: 500 })), false);
  assert.equal(conditionMet(rule, {}, check('UP', { responseTimeMs: 400 })), false);
  assert.equal(conditionMet(rule, {}, check('UP', { responseTimeMs: null })), false);
});

test('conditionMet CONSECUTIVE_FAILURES uses effective pre-increment count for DOWN checks', () => {
  const rule = { type: 'CONSECUTIVE_FAILURES', threshold: 3 };
  assert.equal(conditionMet(rule, { consecutiveFailures: 2 }, check('DOWN')), true);
  assert.equal(conditionMet(rule, { consecutiveFailures: 1 }, check('DOWN')), false);
  assert.equal(conditionMet(rule, { consecutiveFailures: 99 }, check('UP')), false);
});

test('conditionMet unknown rule type always returns false', () => {
  assert.equal(conditionMet({ type: 'UNKNOWN_TYPE' }, {}, check('DOWN')), false);
});

// ─── Fallback: no-op cases ────────────────────────────────────────────────────

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

// ─── Fallback: alert creation ─────────────────────────────────────────────────

test('creates HIGH alert and dispatches when UP → DOWN', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange(
    { service: svc({ currentStatus: 'UP' }), check: check('DOWN', { errorMessage: 'Connection refused' }) },
    deps,
  );
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
  await handleUptimeStateChange(
    { service: svc({ currentStatus: 'UP', url: 'https://api.example.com' }), check: check('DOWN') },
    deps,
  );
  assert.equal(calls.create[0].metricName, 'https://api.example.com');
});

test('metricName is null when service has no URL', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'UP', url: null }), check: check('DOWN') }, deps);
  assert.equal(calls.create[0].metricName, null);
});

// ─── Fallback: deduplication ──────────────────────────────────────────────────

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

// ─── Fallback: alert resolution ───────────────────────────────────────────────

test('resolves open alerts when DOWN → UP', async () => {
  const { calls, deps } = makeFallbackDeps({ openAlerts: [] });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('UP') }, deps);

  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.resolve[0].orgId, 'org-a');
  assert.equal(calls.resolve[0].serviceId, 'service-1');
  assert.equal(calls.create.length, 0);
});

test('resolves open alerts when DEGRADED → UP', async () => {
  const { calls, deps } = makeFallbackDeps({ openAlerts: [] });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DEGRADED' }), check: check('UP') }, deps);

  assert.equal(calls.resolve.length, 1);
  assert.equal(calls.create.length, 0);
});

test('does not resolve when transitioning between DOWN states (DOWN → DEGRADED)', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: true });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('DEGRADED') }, deps);
  assert.equal(calls.resolve.length, 0);
});

test('sends recovery notification when DOWN → UP and open alerts existed', async () => {
  const existingAlert = { id: 'alert-1', title: 'Down alert', severity: 'HIGH', organizationId: 'org-a' };
  const { calls, deps } = makeFallbackDeps({ openAlerts: [existingAlert] });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('UP') }, deps);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.dispatch.length, 1);
  assert.match(calls.dispatch[0].title, /RESOLVED/);
  assert.equal(calls.dispatch[0].severity, 'LOW');
});

test('no recovery notification when DOWN → UP but no open alerts found', async () => {
  const { calls, deps } = makeFallbackDeps({ openAlerts: [] });
  await handleUptimeStateChange({ service: svc({ currentStatus: 'DOWN' }), check: check('UP') }, deps);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.dispatch.length, 0);
});

test('currentStatus defaults to UNKNOWN when missing from service object', async () => {
  const { calls, deps } = makeDeps({ hasOpenResult: false });
  const serviceWithoutStatus = { id: 'service-2', organizationId: 'org-a', name: 'X', slug: 'x', type: 'HTTP', url: null };
  await handleUptimeStateChange({ service: serviceWithoutStatus, check: check('DOWN') }, deps);
  assert.equal(calls.create.length, 1);
});

// ─── Rule-based path ──────────────────────────────────────────────────────────

test('[rules] fires alert when condition met and no existing alert', async () => {
  const { calls, deps } = makeRuleDeps({ conditionFires: true });
  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.create.length, 1);
  assert.equal(calls.create[0].source, 'uptime-rule');
  assert.equal(calls.firedAt.length, 1);
  assert.equal(calls.auditLog.length, 1);
  assert.equal(calls.auditLog[0].action, 'alert.triggered');
});

test('[rules] does not fire when condition not met and no existing alert', async () => {
  const { calls, deps } = makeRuleDeps({ conditionFires: false, existingAlert: null });
  await handleUptimeStateChange({ service: svc(), check: check('UP') }, deps);

  assert.equal(calls.create.length, 0);
  assert.equal(calls.resolveById.length, 0);
});

test('[rules] cooldown suppresses alert when fired within cooldown window', async () => {
  const rule = makeRule({ cooldownSeconds: 300, lastFiredAt: new Date(Date.now() - 10_000) });
  const { calls, deps } = makeRuleDeps({ rules: [rule], conditionFires: true });
  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);

  assert.equal(calls.create.length, 0);
  assert.equal(calls.firedAt.length, 0);
});

test('[rules] fires alert when cooldown window has expired', async () => {
  const rule = makeRule({ cooldownSeconds: 300, lastFiredAt: new Date(Date.now() - 400_000) });
  const { calls, deps } = makeRuleDeps({ rules: [rule], conditionFires: true });
  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);

  assert.equal(calls.create.length, 1);
});

test('[rules] dedup: does not open second alert when one is already open', async () => {
  const existing = { id: 'alert-99', status: 'OPEN' };
  const { calls, deps } = makeRuleDeps({ conditionFires: true, existingAlert: existing });
  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);

  assert.equal(calls.create.length, 0);
  assert.equal(calls.firedAt.length, 0);
});

test('[rules] recovery: resolves open alert and dispatches recovery notification', async () => {
  const existing = { id: 'alert-99', organizationId: 'org-a', title: 'Alert', status: 'OPEN', severity: 'HIGH' };
  const { calls, deps } = makeRuleDeps({ conditionFires: false, existingAlert: existing });
  await handleUptimeStateChange({ service: svc(), check: check('UP') }, deps);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.resolveById.length, 1);
  assert.equal(calls.resolveById[0].id, 'alert-99');
  assert.equal(calls.resolvedAt.length, 1);
  assert.equal(calls.auditLog.length, 1);
  assert.equal(calls.auditLog[0].action, 'alert.resolved');
  assert.equal(calls.dispatch.length, 1);
  assert.match(calls.dispatch[0].title, /RESOLVED/);
  assert.equal(calls.dispatch[0].severity, 'LOW');
});

test('[rules] labels include uptimeRuleId and serviceId for deduplication', async () => {
  const { calls, deps } = makeRuleDeps({ conditionFires: true });
  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);

  const labels = JSON.parse(calls.create[0].labels);
  assert.equal(labels.uptimeRuleId, 'rule-1');
  assert.equal(labels.serviceId, 'service-1');
});

test('[rules] rule with notificationChannelId calls findChannelForDelivery', async () => {
  const rule = makeRule({ notificationChannelId: UUID1 });
  const channelCalls = [];
  const { calls, deps } = makeRuleDeps({ rules: [rule], conditionFires: true });
  deps.findChannelForDelivery = async (channelId, orgId) => {
    channelCalls.push({ channelId, orgId });
    return null;
  };

  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);
  await new Promise((r) => setImmediate(r));

  assert.equal(calls.create.length, 1);
  assert.equal(channelCalls.length, 1);
  assert.equal(channelCalls[0].channelId, UUID1);
});

test('[rules] notification failure does not fail the check (fire-and-forget)', async () => {
  const { calls, deps } = makeRuleDeps({ conditionFires: true });
  deps.dispatch = async () => { throw new Error('SMTP timeout'); };

  await assert.doesNotReject(
    handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps),
  );
  assert.equal(calls.create.length, 1);
});

test('[rules] multiple rules evaluated independently via Promise.allSettled', async () => {
  const rules = [
    makeRule({ id: 'rule-1' }),
    makeRule({ id: 'rule-2', type: 'SERVICE_DEGRADED' }),
  ];
  const created = [];
  const { deps } = makeRuleDeps({ rules, conditionFires: true });
  deps.createAlertFn = async (data) => {
    const alert = { ...data, id: `alert-${created.length}`, triggeredAt: new Date() };
    created.push(alert);
    return alert;
  };

  await handleUptimeStateChange({ service: svc(), check: check('DOWN') }, deps);
  assert.equal(created.length, 2);
});
