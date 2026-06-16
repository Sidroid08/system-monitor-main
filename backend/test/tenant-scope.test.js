import test from 'node:test';
import assert from 'node:assert/strict';

const { requireOrganizationScope } = await import('../src/utils/tenantScope.js');

test('requireOrganizationScope returns the authenticated organization when no override is requested', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  assert.equal(requireOrganizationScope({ organizationId: orgId }), orgId);
});

test('requireOrganizationScope allows matching requested organization id', () => {
  const orgId = '11111111-1111-4111-8111-111111111111';
  assert.equal(requireOrganizationScope({ organizationId: orgId }, orgId), orgId);
});

test('requireOrganizationScope rejects missing or mismatched organization scope', () => {
  assert.throws(() => requireOrganizationScope(null), /Missing organization scope/);
  assert.throws(
    () => requireOrganizationScope(
      { organizationId: '11111111-1111-4111-8111-111111111111' },
      '22222222-2222-4222-8222-222222222222',
    ),
    /Cannot access another organization/,
  );
});
