import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
process.env.VICTORIA_METRICS_URL = 'http://localhost:8428';

const { setAuthContextResolverForTests } = await import('../src/middleware/authenticate.js');
const { createApp } = await import('../src/app.js');

function request(app, { method = 'GET', path = '/', body, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const payload = body ? JSON.stringify(body) : undefined;
      const requestHeaders = {
        ...headers,
        ...(payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {}),
      };
      const req = http.request({
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: requestHeaders,
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          server.close(() => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
        });
      });
      req.on('error', (e) => server.close(() => reject(e)));
      if (payload) req.write(payload);
      req.end();
    });
  });
}

function makeToken(organizationId) {
  return jwt.sign({
    sub: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    organizationId,
    role: 'OWNER',
  }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function useAuthUser({ organizationId, role = 'OWNER', userId = 'user-1' }) {
  setAuthContextResolverForTests(async () => ({
    id: userId,
    email: 'admin@example.com',
    name: 'Admin',
    organizationId,
    membershipId: 'member-1',
    role,
    membershipStatus: 'ACTIVE',
  }));
}

test('liveness probe returns 200 without auth', async () => {
  const app = createApp();
  const res = await request(app, { path: '/health' });
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('protected routes return 401 without token', async () => {
  const app = createApp();
  const routes = [
    { method: 'GET',  path: '/api/instances' },
    { method: 'GET',  path: '/api/org' },
    { method: 'GET',  path: '/api/aws' },
    { method: 'GET',  path: '/api/alert-rules' },
    { method: 'GET',  path: '/api/notification-channels' },
    { method: 'GET',  path: '/api/query/instant?query=up' },
    { method: 'GET',  path: '/api/api-keys' },
    { method: 'GET',  path: '/api/services' },
    { method: 'GET',  path: '/api/worker-health' },
    { method: 'GET',  path: '/api/logs/stats' },
    { method: 'GET',  path: '/api/metrics/aggregate' },
    { method: 'GET',  path: '/api/observability/overview' },
    { method: 'GET',  path: '/api/observability/services/11111111-1111-4111-8111-111111111111/summary' },
    { method: 'GET',  path: '/api/observability/retention/status' },
    { method: 'GET',  path: '/api/observability/victoriametrics/health' },
  ];

  for (const r of routes) {
    const res = await request(app, r);
    assert.equal(res.status, 401, `Expected 401 for ${r.method} ${r.path}, got ${res.status}`);
  }
});

test('tenant-scoped routes reject mismatched organization ids before data access', async () => {
  const app = createApp();
  const token = makeToken('11111111-1111-4111-8111-111111111111');
  useAuthUser({ organizationId: '11111111-1111-4111-8111-111111111111' });
  const headers = { authorization: `Bearer ${token}` };

  const instances = await request(app, {
    path: '/api/instances?orgId=22222222-2222-4222-8222-222222222222',
    headers,
  });
  assert.equal(instances.status, 403);

  const aws = await request(app, {
    method: 'POST',
    path: '/api/aws',
    headers,
    body: {
      organizationId: '22222222-2222-4222-8222-222222222222',
      accountName: 'other-org-account',
      accountId: '123456789012',
      region: 'us-east-1',
      authMode: 'ASSUME_ROLE',
      roleArn: 'arn:aws:iam::123456789012:role/SidroidReadOnly',
    },
  });
  assert.equal(aws.status, 403);
});

test('viewer cannot perform admin mutation', async () => {
  const app = createApp();
  const orgId = '11111111-1111-4111-8111-111111111111';
  useAuthUser({ organizationId: orgId, role: 'VIEWER' });
  const token = makeToken(orgId);

  const res = await request(app, {
    method: 'POST',
    path: '/api/api-keys',
    headers: { authorization: `Bearer ${token}` },
    body: { name: 'viewer-key', scopes: ['metrics:write'] },
  });

  assert.equal(res.status, 403);
});

test('viewer cannot create service or trigger manual check', async () => {
  const app = createApp();
  const orgId = '11111111-1111-4111-8111-111111111111';
  useAuthUser({ organizationId: orgId, role: 'VIEWER' });
  const token = makeToken(orgId);
  const headers = { authorization: `Bearer ${token}` };

  const create = await request(app, {
    method: 'POST',
    path: '/api/services',
    headers,
    body: { name: 'API', type: 'HTTP', url: 'https://example.com/health' },
  });
  assert.equal(create.status, 403);

  const check = await request(app, {
    method: 'POST',
    path: '/api/services/service-1/check',
    headers,
  });
  assert.equal(check.status, 403);
});

test('viewer cannot access worker diagnostics', async () => {
  const app = createApp();
  const orgId = '11111111-1111-4111-8111-111111111111';
  useAuthUser({ organizationId: orgId, role: 'VIEWER' });
  const token = makeToken(orgId);

  const res = await request(app, {
    path: '/api/worker-health',
    headers: { authorization: `Bearer ${token}` },
  });

  assert.equal(res.status, 403);
});

test('auth endpoints are reachable without token', async () => {
  const app = createApp();
  // POST /api/auth/register without a body should return 400 (Zod), not 401 or 404.
  const res = await request(app, { method: 'POST', path: '/api/auth/register', body: {} });
  assert.equal(res.status, 400);
});
