import { forbidden } from '../utils/errors.js';
import { requireOrganizationScope } from '../utils/tenantScope.js';

export const ROLES = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  DEVELOPER: 'DEVELOPER',
  VIEWER: 'VIEWER',
});

const ROLE_RANK = Object.freeze({
  [ROLES.OWNER]: 4,
  [ROLES.ADMIN]: 3,
  [ROLES.DEVELOPER]: 2,
  [ROLES.VIEWER]: 1,
});

export function hasAnyRole(user, allowedRoles = []) {
  return allowedRoles.includes(user?.role);
}

export function hasRoleAtLeast(user, minimumRole) {
  return (ROLE_RANK[user?.role] ?? 0) >= (ROLE_RANK[minimumRole] ?? 0);
}

export function requireAnyRole(...roles) {
  return function requireAnyRoleMiddleware(req, res, next) {
    if (!hasAnyRole(req.user, roles)) {
      return next(forbidden('Insufficient role'));
    }
    return next();
  };
}

export function requireRole(minimumRole) {
  return function requireRoleMiddleware(req, res, next) {
    if (!hasRoleAtLeast(req.user, minimumRole)) {
      return next(forbidden('Insufficient role'));
    }
    return next();
  };
}

export function requireOrgMember(req, res, next) {
  requireOrganizationScope(req.user);
  return next();
}

export function assertOrgScope(user, requestedOrganizationId) {
  return requireOrganizationScope(user, requestedOrganizationId);
}
