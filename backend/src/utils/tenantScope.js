import { forbidden } from './errors.js';

export function getActiveOrgId(user) {
  return user?.organizationId ?? null;
}

export function requireOrganizationScope(user, requestedOrganizationId = undefined) {
  const organizationId = getActiveOrgId(user);
  if (!organizationId) {
    throw forbidden('Missing organization scope');
  }

  if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
    throw forbidden('Cannot access another organization');
  }

  return organizationId;
}
