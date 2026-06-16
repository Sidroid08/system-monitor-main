import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const {
  authenticate,
  setAuthContextResolverForTests,
  resetAuthContextResolverForTests,
} = await import('../src/middleware/authenticate.js');

function makeToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

test('attaches user from valid token with all required claims', async () => {
  setAuthContextResolverForTests(async (payload) => ({
    id: payload.sub,
    email: 'admin@example.com',
    name: 'Admin',
    organizationId: payload.organizationId,
    membershipId: 'member-1',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
  }));

  const token = makeToken({
    sub: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    organizationId: 'org-1',
    role: 'OWNER',
  });

  const req = { headers: { authorization: `Bearer ${token}` } };
  await new Promise((resolve, reject) =>
    authenticate(req, {}, (err) => (err ? reject(err) : resolve())),
  );

  assert.deepEqual(req.user, {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    organizationId: 'org-1',
    membershipId: 'member-1',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
  });
  resetAuthContextResolverForTests();
});

// Helper for tests where authenticate sends a response directly (no next() call).
function callMiddleware(req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; resolve(this); return this; },
    };
    // next() is also provided; if called it resolves too.
    authenticate(req, res, () => resolve(res));
  });
}

test('rejects missing authorization header', async () => {
  const res = await callMiddleware({ headers: {} });
  assert.equal(res.statusCode, 401);
});

test('rejects token missing organizationId', async () => {
  const token = makeToken({ sub: 'user-1', email: 'a@b.com', name: 'A', role: 'OWNER' });
  const res = await callMiddleware({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 401);
  assert.ok(res.body.message.includes('Invalid token payload'));
});

test('rejects tampered token', async () => {
  const res = await callMiddleware({ headers: { authorization: 'Bearer not.a.valid.token' } });
  assert.equal(res.statusCode, 401);
});

test('rejects inactive or missing membership resolved from a valid token', async () => {
  setAuthContextResolverForTests(async () => null);
  const token = makeToken({ sub: 'user-1', organizationId: 'org-1' });
  const res = await callMiddleware({ headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Invalid or inactive session');
  resetAuthContextResolverForTests();
});
