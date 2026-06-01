import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
process.env.VICTORIA_METRICS_URL = 'http://localhost:8428';

const { registerSchema } = await import('../src/modules/auth/auth.schemas.js');
const { createAlertRuleSchema } = await import('../src/modules/alert-rules/alertRules.schemas.js');
const { createChannelSchema } = await import('../src/modules/notifications/notifications.schemas.js');

// ─── Auth schema ──────────────────────────────────────────────────────────────

test('register schema requires organizationName', () => {
  const r = registerSchema.safeParse({
    name: 'Alice', email: 'alice@example.com', password: 'password123',
  });
  assert.equal(r.success, false);
});

test('register schema accepts valid payload', () => {
  const r = registerSchema.parse({
    name: 'Alice', email: 'alice@example.com',
    password: 'password123', organizationName: 'Acme Corp',
  });
  assert.equal(r.organizationName, 'Acme Corp');
});

// ─── AlertRule schema ─────────────────────────────────────────────────────────

test('alert rule schema requires promql and condition', () => {
  const r = createAlertRuleSchema.safeParse({ name: 'test', threshold: 90 });
  assert.equal(r.success, false);
});

test('alert rule schema accepts complete valid payload', () => {
  const r = createAlertRuleSchema.parse({
    name: 'High CPU',
    promql: 'avg(rate(node_cpu_seconds_total[5m])) * 100',
    condition: 'GT',
    threshold: 90,
    forCycles: 2,
    severity: 'HIGH',
  });
  assert.equal(r.condition, 'GT');
  assert.equal(r.forCycles, 2);
});

test('alert rule rejects invalid condition', () => {
  const r = createAlertRuleSchema.safeParse({
    name: 'Bad', promql: 'up', condition: 'INVALID', threshold: 1,
  });
  assert.equal(r.success, false);
});

// ─── NotificationChannel schema ───────────────────────────────────────────────

test('email channel requires valid recipient list', () => {
  const r = createChannelSchema.safeParse({
    type: 'EMAIL', name: 'Ops email', config: { to: ['not-an-email'] },
  });
  assert.equal(r.success, false);
});

test('slack channel requires webhookUrl', () => {
  const r = createChannelSchema.safeParse({
    type: 'SLACK', name: 'Slack ops', config: {},
  });
  assert.equal(r.success, false);
});

test('slack channel accepts valid webhookUrl', () => {
  const r = createChannelSchema.parse({
    type: 'SLACK', name: 'Slack ops',
    config: { webhookUrl: 'https://hooks.slack.com/services/T000/B000/xxxx' },
  });
  assert.equal(r.type, 'SLACK');
});

test('webhook channel accepts url + optional method and headers', () => {
  const r = createChannelSchema.parse({
    type: 'WEBHOOK', name: 'PagerDuty',
    config: { url: 'https://events.pagerduty.com/v2/enqueue', headers: { 'X-Routing-Key': 'abc' } },
  });
  assert.equal(r.config.method, 'POST');
});
