import { forbidden } from './errors.js';

export function requireOrganizationScope(user, requestedOrganizationId = undefined) {
  const organizationId = user?.organizationId;
  if (!organizationId) {
    throw forbidden('Missing organization scope');
  }

  if (requestedOrganizationId && requestedOrganizationId !== organizationId) {
    throw forbidden('Cannot access another organization');
  }

  return organizationId;
}
