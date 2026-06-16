import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { listAlertsSchema, updateAlertSchema } = await import('../src/modules/alerts/alerts.schemas.js');
const { makeAlertsController } = await import('../src/modules/alerts/alerts.controller.js');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body)   { this.body = body;   return this; },
  };
}

function makeReq({ query = {}, params = {}, body = {}, role = 'DEVELOPER' } = {}) {
  return {
    user: { id: 'user-1', organizationId: 'org-a', role },
    query, params, body,
  };
}

function baseAlert(overrides = {}) {
  return {
    id: 'alert-1',
    organizationId: 'org-a',
    ruleId: null,
    title: 'CPU high',
    description: null,
    severity: 'HIGH',
    source: 'alert-rule-engine',
    metricName: null,
    instanceId: null,
    status: 'OPEN',
    triggeredAt: new Date(),
    resolvedAt: null,
    labels: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─── Schema: listAlertsSchema ─────────────────────────────────────────────────

test('listAlertsSchema defaults limit=50 and offset=0', () => {
  const result = listAlertsSchema.parse({});
  assert.equal(result.limit, 50);
  assert.equal(result.offset, 0);
  assert.equal(result.status, undefined);
  assert.equal(result.severity, undefined);
});

test('listAlertsSchema coerces string numbers for limit and offset', () => {
  const result = listAlertsSchema.parse({ limit: '25', offset: '10' });
  assert.equal(result.limit, 25);
  assert.equal(result.offset, 10);
});

test('listAlertsSchema clamps limit to 200', () => {
  assert.throws(() => listAlertsSchema.parse({ limit: '999' }));
});

test('listAlertsSchema accepts all valid status values', () => {
  assert.doesNotThrow(() => listAlertsSchema.parse({ status: 'OPEN' }));
  assert.doesNotThrow(() => listAlertsSchema.parse({ status: 'ACKNOWLEDGED' }));
  assert.doesNotThrow(() => listAlertsSchema.parse({ status: 'RESOLVED' }));
});

test('listAlertsSchema rejects unknown status', () => {
  assert.throws(() => listAlertsSchema.parse({ status: 'PENDING' }));
});

test('listAlertsSchema accepts all valid severity values', () => {
  for (const sev of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
    assert.doesNotThrow(() => listAlertsSchema.parse({ severity: sev }));
  }
});

test('listAlertsSchema rejects malformed ruleId', () => {
  assert.throws(() => listAlertsSchema.parse({ ruleId: 'not-a-uuid' }));
});

test('listAlertsSchema accepts valid UUID for ruleId', () => {
  const result = listAlertsSchema.parse({ ruleId: '123e4567-e89b-12d3-a456-426614174000' });
  assert.equal(result.ruleId, '123e4567-e89b-12d3-a456-426614174000');
});

// ─── Schema: updateAlertSchema ────────────────────────────────────────────────

test('updateAlertSchema accepts ACKNOWLEDGED', () => {
  const result = updateAlertSchema.parse({ status: 'ACKNOWLEDGED' });
  assert.equal(result.status, 'ACKNOWLEDGED');
});

test('updateAlertSchema accepts RESOLVED', () => {
  const result = updateAlertSchema.parse({ status: 'RESOLVED' });
  assert.equal(result.status, 'RESOLVED');
});

test('updateAlertSchema rejects OPEN (alerts cannot be re-opened)', () => {
  assert.throws(() => updateAlertSchema.parse({ status: 'OPEN' }));
});

test('updateAlertSchema rejects unknown values', () => {
  assert.throws(() => updateAlertSchema.parse({ status: 'SNOOZED' }));
});

test('updateAlertSchema rejects missing status', () => {
  assert.throws(() => updateAlertSchema.parse({}));
});

// ─── Controller: list ────────────────────────────────────────────────────────

test('alerts controller list passes organizationId and parsed filters to repo', async () => {
  const calls = [];
  const controller = makeAlertsController({
    repo: {
      listAlerts: async (orgId, filters) => {
        calls.push({ orgId, filters });
        return { alerts: [baseAlert()], total: 1 };
      },
    },
  });

  const res = makeRes();
  await controller.list(makeReq({ query: { status: 'OPEN', limit: '10' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.total, 1);
  assert.equal(calls[0].orgId, 'org-a');
  assert.equal(calls[0].filters.status, 'OPEN');
  assert.equal(calls[0].filters.limit, 10);
});

test('alerts controller list always scopes to the calling user org', async () => {
  const seenOrgs = [];
  const controller = makeAlertsController({
    repo: {
      listAlerts: async (orgId) => {
        seenOrgs.push(orgId);
        return { alerts: [], total: 0 };
      },
    },
  });

  await controller.list(makeReq(), makeRes());
  assert.deepEqual(seenOrgs, ['org-a']);
});

// ─── Controller: get ─────────────────────────────────────────────────────────

test('alerts controller get returns 404 when repo returns null', async () => {
  const controller = makeAlertsController({
    repo: {
      findAlert: async (id, orgId) => {
        assert.equal(orgId, 'org-a');
        return null;
      },
    },
  });

  await assert.rejects(
    () => controller.get(makeReq({ params: { id: 'missing' } }), makeRes()),
    /Alert not found/,
  );
});

test('alerts controller get returns alert in correct org', async () => {
  const controller = makeAlertsController({
    repo: {
      findAlert: async (id, orgId) => {
        assert.equal(id, 'alert-1');
        assert.equal(orgId, 'org-a');
        return baseAlert();
      },
    },
  });

  const res = makeRes();
  await controller.get(makeReq({ params: { id: 'alert-1' } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.alert.id, 'alert-1');
});

// ─── Controller: update ───────────────────────────────────────────────────────

test('alerts controller update returns 404 when no rows updated', async () => {
  const controller = makeAlertsController({
    repo: {
      updateAlertStatus: async () => ({ count: 0 }),
    },
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.update(makeReq({ params: { id: 'missing' }, body: { status: 'RESOLVED' } }), makeRes()),
    /Alert not found/,
  );
});

test('alerts controller update writes audit log on success', async () => {
  const auditCalls = [];
  const controller = makeAlertsController({
    repo: {
      updateAlertStatus: async (id, orgId, status) => {
        assert.equal(orgId, 'org-a');
        assert.equal(status, 'ACKNOWLEDGED');
        return { count: 1 };
      },
    },
    auditLog: async (entry) => { auditCalls.push(entry); },
  });

  const res = makeRes();
  await controller.update(makeReq({ params: { id: 'alert-1' }, body: { status: 'ACKNOWLEDGED' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'alert.acknowledged');
  assert.equal(auditCalls[0].resourceId, 'alert-1');
});

test('alerts controller update rejects body with invalid status via schema', async () => {
  const controller = makeAlertsController({
    repo: { updateAlertStatus: async () => ({ count: 1 }) },
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.update(makeReq({ body: { status: 'OPEN' } }), makeRes()),
  );
});
