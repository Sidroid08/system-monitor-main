import test from 'node:test';
import assert from 'node:assert/strict';

const {
  hasAnyRole,
  hasRoleAtLeast,
  ROLES,
} = await import('../src/middleware/authorization.js');

test('role hierarchy treats owner as highest and viewer as read-only baseline', () => {
  assert.equal(hasRoleAtLeast({ role: ROLES.OWNER }, ROLES.ADMIN), true);
  assert.equal(hasRoleAtLeast({ role: ROLES.ADMIN }, ROLES.DEVELOPER), true);
  assert.equal(hasRoleAtLeast({ role: ROLES.DEVELOPER }, ROLES.VIEWER), true);
  assert.equal(hasRoleAtLeast({ role: ROLES.VIEWER }, ROLES.DEVELOPER), false);
});

test('hasAnyRole only allows explicit roles', () => {
  assert.equal(hasAnyRole({ role: ROLES.ADMIN }, [ROLES.OWNER, ROLES.ADMIN]), true);
  assert.equal(hasAnyRole({ role: ROLES.VIEWER }, [ROLES.OWNER, ROLES.ADMIN]), false);
});
