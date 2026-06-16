import prisma from './prisma.js';

function contextFromUserAndMembership(user, membership) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    membershipStatus: membership.status,
    organization: membership.organization
      ? {
          id: membership.organization.id,
          name: membership.organization.name,
          slug: membership.organization.slug,
        }
      : undefined,
  };
}

export async function resolveAuthContext(payload) {
  if (!payload?.sub || !payload?.organizationId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      memberships: {
        where: { organizationId: payload.organizationId },
        include: { organization: true },
      },
    },
  });

  if (!user?.isActive) return null;

  const membership = user.memberships?.find((m) => m.status === 'ACTIVE');
  if (!membership) return null;

  return contextFromUserAndMembership(user, membership);
}
