import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { createServiceSchema } = await import('../src/modules/services/services.schemas.js');
const { makeServicesController } = await import('../src/modules/services/services.controller.js');
const {
  calculateCheckStatus,
  performHttpCheck,
} = await import('../src/modules/services/services.health.js');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeReq({ body = {}, params = {}, query = {}, role = 'DEVELOPER' } = {}) {
  return {
    user: {
      id: 'user-1',
      organizationId: 'org-a',
      role,
    },
    body,
    params,
    query,
  };
}

function baseService(overrides = {}) {
  return {
    id: 'service-1',
    organizationId: 'org-a',
    name: 'Public API',
    slug: 'public-api',
    description: null,
    type: 'HTTP',
    environment: 'production',
    url: 'https://example.com',
    healthPath: '/health',
    method: 'GET',
    expectedStatusCode: 200,
    timeoutMs: 5000,
    intervalSeconds: 60,
    isActive: true,
    tags: null,
    currentStatus: 'UNKNOWN',
    lastCheckedAt: null,
    lastResponseTimeMs: null,
    ...overrides,
  };
}

test('service schema requires URL for HTTP/API/WEB services', () => {
  const missingUrl = createServiceSchema.safeParse({ name: 'API', type: 'HTTP' });
  assert.equal(missingUrl.success, false);

  const valid = createServiceSchema.parse({
    name: 'API',
    type: 'HTTP',
    url: 'https://example.com',
  });
  assert.equal(valid.method, 'GET');
  assert.equal(valid.timeoutMs, 5000);
});

test('service schema rejects unsafe timeout, interval, status code, and unknown organizationId', () => {
  assert.equal(createServiceSchema.safeParse({
    name: 'API',
    type: 'HTTP',
    url: 'https://example.com',
    timeoutMs: 100,
  }).success, false);

  assert.equal(createServiceSchema.safeParse({
    name: 'API',
    type: 'HTTP',
    url: 'https://example.com',
    intervalSeconds: 10,
  }).success, false);

  assert.equal(createServiceSchema.safeParse({
    name: 'API',
    type: 'HTTP',
    url: 'https://example.com',
    expectedStatusCode: 99,
  }).success, false);

  assert.equal(createServiceSchema.safeParse({
    name: 'API',
    type: 'HTTP',
    url: 'https://example.com',
    organizationId: 'org-b',
  }).success, false);
});

test('service controller creates and lists services in the active organization', async () => {
  const calls = [];
  const controller = makeServicesController({
    repo: {
      createService: async (data) => {
        calls.push(['create', data.organizationId, data.createdByUserId]);
        return baseService({ ...data, id: 'service-1', currentStatus: 'UNKNOWN' });
      },
      listServices: async (organizationId) => {
        calls.push(['list', organizationId]);
        return { services: [baseService()], total: 1 };
      },
    },
    writeAuditLog: async () => {},
  });

  const createRes = makeRes();
  await controller.create(makeReq({
    body: {
      name: 'Public API',
      type: 'HTTP',
      url: 'https://example.com',
      healthPath: '/health',
    },
  }), createRes);
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.data.service.organizationId, 'org-a');

  const listRes = makeRes();
  await controller.list(makeReq(), listRes);
  assert.equal(listRes.body.data.services[0].organizationId, 'org-a');
  assert.deepEqual(calls, [
    ['create', 'org-a', 'user-1'],
    ['list', 'org-a'],
  ]);
});

test('service controller returns not found for cross-org read/update/delete/check', async () => {
  const controller = makeServicesController({
    repo: {
      findServiceById: async (id, organizationId) => {
        assert.equal(organizationId, 'org-a');
        return null;
      },
      softDeleteService: async (id, organizationId) => {
        assert.equal(organizationId, 'org-a');
        return 0;
      },
    },
    writeAuditLog: async () => {},
  });

  await assert.rejects(
    () => controller.get(makeReq({ params: { id: 'foreign-service' } }), makeRes()),
    /Service not found/,
  );
  await assert.rejects(
    () => controller.update(makeReq({ params: { id: 'foreign-service' }, body: { name: 'New' } }), makeRes()),
    /Service not found/,
  );
  await assert.rejects(
    () => controller.remove(makeReq({ params: { id: 'foreign-service' } }), makeRes()),
    /Service not found/,
  );
  await assert.rejects(
    () => controller.check(makeReq({ params: { id: 'foreign-service' } }), makeRes()),
    /Service not found/,
  );
});

test('manual check stores clean result without response body', async () => {
  const stored = [];
  const controller = makeServicesController({
    repo: {
      findServiceById: async () => baseService(),
      createUptimeCheck: async (organizationId, serviceId, result) => {
        stored.push({ organizationId, serviceId, result });
        return { id: 'check-1', organizationId, serviceId, checkedAt: new Date(), ...result };
      },
    },
    performHttpCheck: async () => ({
      status: 'UP',
      httpStatusCode: 200,
      responseTimeMs: 42,
      errorMessage: null,
      checkSource: 'manual',
      metadata: { method: 'GET' },
    }),
    writeAuditLog: async () => {},
  });

  const res = makeRes();
  await controller.check(makeReq({ params: { id: 'service-1' } }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(stored[0].organizationId, 'org-a');
  assert.equal(stored[0].serviceId, 'service-1');
  assert.equal(stored[0].result.status, 'UP');
  assert.equal(stored[0].result.body, undefined);
});

test('manual check stores DOWN result for failed check', async () => {
  const controller = makeServicesController({
    repo: {
      findServiceById: async () => baseService(),
      createUptimeCheck: async (organizationId, serviceId, result) => ({ id: 'check-1', organizationId, serviceId, ...result }),
    },
    performHttpCheck: async () => ({
      status: 'DOWN',
      httpStatusCode: null,
      responseTimeMs: 5000,
      errorMessage: 'Request timed out',
      checkSource: 'manual',
      metadata: {},
    }),
    writeAuditLog: async () => {},
  });

  const res = makeRes();
  await controller.check(makeReq({ params: { id: 'service-1' } }), res);
  assert.equal(res.body.data.check.status, 'DOWN');
  assert.equal(res.body.data.check.errorMessage, 'Request timed out');
});

test('check status calculation handles up, degraded, and down', () => {
  assert.equal(calculateCheckStatus({ httpStatusCode: 200, responseTimeMs: 100, expectedStatusCode: 200, timeoutMs: 5000 }), 'UP');
  assert.equal(calculateCheckStatus({ httpStatusCode: 200, responseTimeMs: 4900, expectedStatusCode: 200, timeoutMs: 5000 }), 'DEGRADED');
  assert.equal(calculateCheckStatus({ httpStatusCode: 404, responseTimeMs: 100, expectedStatusCode: 200, timeoutMs: 5000 }), 'DEGRADED');
  assert.equal(calculateCheckStatus({ httpStatusCode: 500, responseTimeMs: 100, expectedStatusCode: 200, timeoutMs: 5000 }), 'DOWN');
  assert.equal(calculateCheckStatus({ error: 'timeout', expectedStatusCode: 200, timeoutMs: 5000 }), 'DOWN');
});

test('performHttpCheck does not read response body and records response time', async () => {
  let nowValue = 1000;
  const result = await performHttpCheck(baseService(), {
    resolver: async () => [{ address: '93.184.216.34' }],
    now: () => {
      nowValue += 25;
      return nowValue;
    },
    fetchImpl: async () => ({
      status: 200,
      async text() {
        throw new Error('body should not be read');
      },
    }),
  });

  assert.equal(result.status, 'UP');
  assert.equal(result.httpStatusCode, 200);
  assert.equal(result.responseTimeMs, 25);
  assert.equal(result.errorMessage, null);
});

test('performHttpCheck rejects localhost and private resolved targets', async () => {
  await assert.rejects(
    () => performHttpCheck(baseService({ url: 'http://localhost:3000' })),
    /not allowed/,
  );

  await assert.rejects(
    () => performHttpCheck(baseService({ url: 'https://internal.example.com' }), {
      resolver: async () => [{ address: '10.0.0.1' }],
      fetchImpl: async () => ({ status: 200 }),
    }),
    /private or blocked/,
  );
});
