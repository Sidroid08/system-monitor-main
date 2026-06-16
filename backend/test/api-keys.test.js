import test from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
process.env.API_KEY_PEPPER = 'test-api-key-pepper-at-least-32-chars';
process.env.DATABASE_URL = 'mysql://user:password@localhost:3306/sidroid_test';

const { makeApiKeysController } = await import('../src/modules/api-keys/apiKeys.controller.js');
const { hashApiKey, toApiKeyMetadata } = await import('../src/modules/api-keys/apiKeys.service.js');

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('API key hashing is deterministic and does not expose the raw key', () => {
  const raw = 'sm_test_example';
  assert.equal(hashApiKey(raw), hashApiKey(raw));
  assert.notEqual(hashApiKey(raw), raw);
});

test('API key metadata never includes keyHash or raw key', () => {
  const metadata = toApiKeyMetadata({
    id: 'key-1',
    organizationId: 'org-1',
    name: 'Ingestion',
    prefix: 'sm_test_abc',
    keyHash: 'hash-value',
    scopes: '["metrics:write"]',
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  assert.equal(metadata.keyHash, undefined);
  assert.equal(metadata.key, undefined);
  assert.deepEqual(metadata.scopes, ['metrics:write']);
});

test('API key controller scopes list/create/revoke to active organization', async () => {
  const calls = [];
  const controller = makeApiKeysController({
    keyService: {
      generateRawApiKey: () => 'sm_test_rawsecret',
      apiKeyPrefix: () => 'sm_test_raw',
      hashApiKey: () => 'hashed',
    },
    repo: {
      createApiKeyRecord: async (data) => {
        calls.push(['create', data.organizationId]);
        return {
          id: 'key-1',
          organizationId: data.organizationId,
          name: data.name,
          prefix: data.prefix,
          scopes: data.scopes,
          isActive: true,
        };
      },
      listApiKeyRecords: async (organizationId) => {
        calls.push(['list', organizationId]);
        return [{ id: 'key-1', organizationId, name: 'Key', prefix: 'sm_test_raw', scopes: ['metrics:write'] }];
      },
      revokeApiKeyRecord: async (id, organizationId) => {
        calls.push(['revoke', organizationId, id]);
        return 1;
      },
    },
    writeAuditLog: async () => {},
  });

  const req = {
    user: { id: 'user-1', organizationId: 'org-a' },
    body: { name: 'Ingestion', scopes: ['metrics:write'] },
    params: { id: 'key-1' },
  };

  const createRes = makeRes();
  await controller.create(req, createRes);
  assert.equal(createRes.statusCode, 201);
  assert.equal(createRes.body.data.key, 'sm_test_rawsecret');
  assert.equal(createRes.body.data.apiKey.keyHash, undefined);

  const listRes = makeRes();
  await controller.list(req, listRes);
  assert.equal(listRes.body.data.key, undefined);
  assert.equal(listRes.body.data.apiKeys[0].organizationId, 'org-a');

  const revokeRes = makeRes();
  await controller.revoke(req, revokeRes);
  assert.deepEqual(calls, [
    ['create', 'org-a'],
    ['list', 'org-a'],
    ['revoke', 'org-a', 'key-1'],
  ]);
});
