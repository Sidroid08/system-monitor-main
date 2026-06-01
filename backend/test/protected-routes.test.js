import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';
process.env.VICTORIA_METRICS_URL = 'http://localhost:8428';

const { createApp } = await import('../src/app.js');

function request(app, { method = 'GET', path = '/', body } = {}) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const addr = server.address();
      const payload = body ? JSON.stringify(body) : undefined;
      const req = http.request({
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: payload
          ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
          : {},
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
    { method: 'GET',  path: '/api/aws' },
    { method: 'GET',  path: '/api/alert-rules' },
    { method: 'GET',  path: '/api/notification-channels' },
    { method: 'GET',  path: '/api/query/instant?query=up' },
  ];

  for (const r of routes) {
    const res = await request(app, r);
    assert.equal(res.status, 401, `Expected 401 for ${r.method} ${r.path}, got ${res.status}`);
  }
});

test('auth endpoints are reachable without token', async () => {
  const app = createApp();
  // POST /api/auth/register without a body should return 400 (Zod), not 401 or 404.
  const res = await request(app, { method: 'POST', path: '/api/auth/register', body: {} });
  assert.equal(res.status, 400);
});
