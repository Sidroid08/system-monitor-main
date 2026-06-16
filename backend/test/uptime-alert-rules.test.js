import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const {
  createUptimeAlertRuleSchema,
  updateUptimeAlertRuleSchema,
  listUptimeAlertRulesSchema,
} = await import('../src/modules/uptime-alert-rules/uptimeAlertRules.schemas.js');

const { makeUptimeAlertRulesController } = await import('../src/modules/uptime-alert-rules/uptimeAlertRules.controller.js');

const UUID1 = '123e4567-e89b-12d3-a456-426614174000';
const UUID2 = '223e4567-e89b-12d3-a456-426614174001';

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

function baseRule(overrides = {}) {
  return {
    id: 'rule-1',
    organizationId: 'org-a',
    serviceId: null,
    name: 'API Down',
    type: 'SERVICE_DOWN',
    severity: 'MEDIUM',
    isActive: true,
    threshold: null,
    cooldownSeconds: 300,
    notificationChannelId: null,
    createdByUserId: 'user-1',
    lastFiredAt: null,
    lastResolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeRepo(overrides = {}) {
  return {
    createUptimeAlertRule: async (data) => baseRule({ ...data, id: 'rule-1' }),
    listUptimeAlertRules: async () => ({ rules: [], total: 0 }),
    findUptimeAlertRule: async () => null,
    updateUptimeAlertRule: async () => ({ count: 1 }),
    deleteUptimeAlertRule: async () => ({ count: 1 }),
    serviceExistsInOrg: async () => true,
    channelExistsInOrg: async () => true,
    ...overrides,
  };
}

// ─── Schema: createUptimeAlertRuleSchema ──────────────────────────────────────

test('create schema accepts SERVICE_DOWN without threshold', () => {
  assert.doesNotThrow(() => createUptimeAlertRuleSchema.parse({ name: 'Down rule', type: 'SERVICE_DOWN' }));
});

test('create schema accepts SERVICE_DEGRADED without threshold', () => {
  assert.doesNotThrow(() => createUptimeAlertRuleSchema.parse({ name: 'Degraded rule', type: 'SERVICE_DEGRADED' }));
});

test('create schema rejects RESPONSE_TIME_ABOVE without threshold', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Slow', type: 'RESPONSE_TIME_ABOVE' }));
});

test('create schema accepts RESPONSE_TIME_ABOVE with threshold', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Slow', type: 'RESPONSE_TIME_ABOVE', threshold: 500 });
  assert.equal(result.threshold, 500);
});

test('create schema rejects CONSECUTIVE_FAILURES without threshold', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Flap', type: 'CONSECUTIVE_FAILURES' }));
});

test('create schema accepts CONSECUTIVE_FAILURES with threshold', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Flap', type: 'CONSECUTIVE_FAILURES', threshold: 3 });
  assert.equal(result.threshold, 3);
});

test('create schema defaults cooldownSeconds to 300', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN' });
  assert.equal(result.cooldownSeconds, 300);
});

test('create schema rejects cooldownSeconds above 86400', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', cooldownSeconds: 100000 }));
});

test('create schema allows cooldownSeconds of 0', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', cooldownSeconds: 0 });
  assert.equal(result.cooldownSeconds, 0);
});

test('create schema rejects non-UUID serviceId', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', serviceId: 'not-a-uuid' }));
});

test('create schema accepts valid UUID serviceId', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', serviceId: UUID1 });
  assert.equal(result.serviceId, UUID1);
});

test('create schema rejects non-UUID notificationChannelId', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', notificationChannelId: 'bad' }));
});

test('create schema accepts valid UUID notificationChannelId', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN', notificationChannelId: UUID1 });
  assert.equal(result.notificationChannelId, UUID1);
});

test('create schema defaults isActive to true', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN' });
  assert.equal(result.isActive, true);
});

test('create schema defaults severity to MEDIUM', () => {
  const result = createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'SERVICE_DOWN' });
  assert.equal(result.severity, 'MEDIUM');
});

test('create schema rejects empty name', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: '', type: 'SERVICE_DOWN' }));
});

test('create schema rejects unknown rule type', () => {
  assert.throws(() => createUptimeAlertRuleSchema.parse({ name: 'Test', type: 'UNKNOWN_TYPE' }));
});

// ─── Schema: updateUptimeAlertRuleSchema ─────────────────────────────────────

test('update schema allows partial update (name only)', () => {
  const result = updateUptimeAlertRuleSchema.parse({ name: 'New name' });
  assert.equal(result.name, 'New name');
  assert.equal(result.type, undefined);
});

test('update schema allows partial update (isActive only)', () => {
  const result = updateUptimeAlertRuleSchema.parse({ isActive: false });
  assert.equal(result.isActive, false);
});

test('update schema rejects changing type to RESPONSE_TIME_ABOVE without threshold', () => {
  assert.throws(() => updateUptimeAlertRuleSchema.parse({ type: 'RESPONSE_TIME_ABOVE' }));
});

test('update schema accepts changing type to RESPONSE_TIME_ABOVE with threshold', () => {
  const result = updateUptimeAlertRuleSchema.parse({ type: 'RESPONSE_TIME_ABOVE', threshold: 1000 });
  assert.equal(result.threshold, 1000);
});

test('update schema rejects changing type to CONSECUTIVE_FAILURES without threshold', () => {
  assert.throws(() => updateUptimeAlertRuleSchema.parse({ type: 'CONSECUTIVE_FAILURES' }));
});

test('update schema accepts empty update (no fields)', () => {
  assert.doesNotThrow(() => updateUptimeAlertRuleSchema.parse({}));
});

// ─── Schema: listUptimeAlertRulesSchema ──────────────────────────────────────

test('list schema defaults limit=50 and offset=0', () => {
  const result = listUptimeAlertRulesSchema.parse({});
  assert.equal(result.limit, 50);
  assert.equal(result.offset, 0);
});

test('list schema coerces string numbers', () => {
  const result = listUptimeAlertRulesSchema.parse({ limit: '20', offset: '5' });
  assert.equal(result.limit, 20);
  assert.equal(result.offset, 5);
});

test('list schema coerces isActive string to boolean', () => {
  assert.equal(listUptimeAlertRulesSchema.parse({ isActive: 'true' }).isActive, true);
  assert.equal(listUptimeAlertRulesSchema.parse({ isActive: 'false' }).isActive, false);
});

test('list schema rejects invalid serviceId', () => {
  assert.throws(() => listUptimeAlertRulesSchema.parse({ serviceId: 'bad-id' }));
});

test('list schema accepts valid UUID serviceId', () => {
  const result = listUptimeAlertRulesSchema.parse({ serviceId: UUID1 });
  assert.equal(result.serviceId, UUID1);
});

// ─── Controller: list ────────────────────────────────────────────────────────

test('list passes organizationId and parsed filters to repo', async () => {
  const calls = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      listUptimeAlertRules: async (orgId, opts) => {
        calls.push({ orgId, opts });
        return { rules: [baseRule()], total: 1 };
      },
    }),
    auditLog: async () => {},
  });

  const res = makeRes();
  await controller.list(makeReq({ query: { isActive: 'true', limit: '10' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.data.total, 1);
  assert.equal(calls[0].orgId, 'org-a');
  assert.equal(calls[0].opts.isActive, true);
  assert.equal(calls[0].opts.limit, 10);
});

test('list always scopes to calling user org', async () => {
  const seenOrgs = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      listUptimeAlertRules: async (orgId) => {
        seenOrgs.push(orgId);
        return { rules: [], total: 0 };
      },
    }),
    auditLog: async () => {},
  });

  await controller.list(makeReq(), makeRes());
  assert.deepEqual(seenOrgs, ['org-a']);
});

// ─── Controller: get ─────────────────────────────────────────────────────────

test('get returns 404 when rule not found in org', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ findUptimeAlertRule: async () => null }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.get(makeReq({ params: { id: 'missing' } }), makeRes()),
    /Uptime alert rule not found/,
  );
});

test('get passes id and organizationId to repo', async () => {
  const seen = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      findUptimeAlertRule: async (id, orgId) => {
        seen.push({ id, orgId });
        return baseRule();
      },
    }),
    auditLog: async () => {},
  });

  const res = makeRes();
  await controller.get(makeReq({ params: { id: 'rule-1' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(seen[0].id, 'rule-1');
  assert.equal(seen[0].orgId, 'org-a');
  assert.equal(res.body.data.rule.id, 'rule-1');
});

// ─── Controller: create ───────────────────────────────────────────────────────

test('create returns 201 and writes audit log', async () => {
  const auditCalls = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo(),
    auditLog: async (entry) => { auditCalls.push(entry); },
  });

  const res = makeRes();
  await controller.create(makeReq({ body: { name: 'API Down', type: 'SERVICE_DOWN' } }), res);

  assert.equal(res.statusCode, 201);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'uptime_alert_rule.created');
  assert.equal(auditCalls[0].organizationId, 'org-a');
});

test('create sets organizationId and createdByUserId from authenticated user', async () => {
  const created = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      createUptimeAlertRule: async (data) => {
        created.push(data);
        return baseRule(data);
      },
    }),
    auditLog: async () => {},
  });

  await controller.create(makeReq({ body: { name: 'Test', type: 'SERVICE_DOWN' } }), makeRes());

  assert.equal(created[0].organizationId, 'org-a');
  assert.equal(created[0].createdByUserId, 'user-1');
});

test('create rejects cross-org serviceId', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ serviceExistsInOrg: async () => false }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.create(makeReq({ body: { name: 'Test', type: 'SERVICE_DOWN', serviceId: UUID1 } }), makeRes()),
    /serviceId not found in this organization/,
  );
});

test('create rejects cross-org notificationChannelId', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ channelExistsInOrg: async () => false }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.create(makeReq({ body: { name: 'Test', type: 'SERVICE_DOWN', notificationChannelId: UUID1 } }), makeRes()),
    /notificationChannelId not found in this organization/,
  );
});

test('create validates cross-org guard before writing to db', async () => {
  const callOrder = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      serviceExistsInOrg: async () => { callOrder.push('guard'); return false; },
      createUptimeAlertRule: async () => { callOrder.push('create'); return baseRule(); },
    }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.create(makeReq({ body: { name: 'Test', type: 'SERVICE_DOWN', serviceId: UUID1 } }), makeRes()),
  );
  assert.ok(callOrder.includes('guard'));
  assert.ok(!callOrder.includes('create'));
});

test('create does not call serviceExistsInOrg when serviceId is not provided', async () => {
  const guardCalls = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ serviceExistsInOrg: async () => { guardCalls.push(1); return true; } }),
    auditLog: async () => {},
  });

  await controller.create(makeReq({ body: { name: 'Test', type: 'SERVICE_DOWN' } }), makeRes());
  assert.equal(guardCalls.length, 0);
});

// ─── Controller: update ───────────────────────────────────────────────────────

test('update returns 404 when no rows updated', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ updateUptimeAlertRule: async () => ({ count: 0 }) }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.update(makeReq({ params: { id: 'missing' }, body: { isActive: false } }), makeRes()),
    /Uptime alert rule not found/,
  );
});

test('update scopes write to calling user org', async () => {
  const seen = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      updateUptimeAlertRule: async (id, orgId, data) => {
        seen.push({ id, orgId });
        return { count: 1 };
      },
    }),
    auditLog: async () => {},
  });

  await controller.update(makeReq({ params: { id: 'rule-1' }, body: { isActive: false } }), makeRes());
  assert.equal(seen[0].orgId, 'org-a');
});

test('update writes audit log with updated field names', async () => {
  const auditCalls = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo(),
    auditLog: async (entry) => { auditCalls.push(entry); },
  });

  await controller.update(makeReq({ params: { id: 'rule-1' }, body: { isActive: false, name: 'New' } }), makeRes());

  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'uptime_alert_rule.updated');
  assert.ok(auditCalls[0].metadata.fields.includes('isActive'));
  assert.ok(auditCalls[0].metadata.fields.includes('name'));
});

test('update rejects cross-org serviceId on patch', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ serviceExistsInOrg: async () => false }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.update(makeReq({ params: { id: 'rule-1' }, body: { serviceId: UUID2 } }), makeRes()),
    /serviceId not found in this organization/,
  );
});

// ─── Controller: remove ───────────────────────────────────────────────────────

test('remove returns 404 when no rows deleted', async () => {
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({ deleteUptimeAlertRule: async () => ({ count: 0 }) }),
    auditLog: async () => {},
  });

  await assert.rejects(
    () => controller.remove(makeReq({ params: { id: 'missing' } }), makeRes()),
    /Uptime alert rule not found/,
  );
});

test('remove scopes delete to calling user org', async () => {
  const seen = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo({
      deleteUptimeAlertRule: async (id, orgId) => {
        seen.push({ id, orgId });
        return { count: 1 };
      },
    }),
    auditLog: async () => {},
  });

  await controller.remove(makeReq({ params: { id: 'rule-1' } }), makeRes());
  assert.equal(seen[0].id, 'rule-1');
  assert.equal(seen[0].orgId, 'org-a');
});

test('remove writes audit log', async () => {
  const auditCalls = [];
  const controller = makeUptimeAlertRulesController({
    repo: makeRepo(),
    auditLog: async (entry) => { auditCalls.push(entry); },
  });

  const res = makeRes();
  await controller.remove(makeReq({ params: { id: 'rule-1' } }), res);

  assert.equal(res.statusCode, 200);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'uptime_alert_rule.deleted');
  assert.equal(auditCalls[0].resourceId, 'rule-1');
  assert.equal(auditCalls[0].organizationId, 'org-a');
});
