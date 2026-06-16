import prisma from '../../lib/prisma.js';

const ruleSelect = {
  id: true, organizationId: true, serviceId: true,
  name: true, type: true, severity: true, isActive: true,
  threshold: true, cooldownSeconds: true,
  notificationChannelId: true, createdByUserId: true,
  lastFiredAt: true, lastResolvedAt: true,
  createdAt: true, updatedAt: true,
};

// ─── Cross-org guard helpers ──────────────────────────────────────────────────

// Returns true if the serviceId belongs to the organization.
export async function serviceExistsInOrg(serviceId, organizationId) {
  const count = await prisma.monitoredService.count({
    where: { id: serviceId, organizationId, deletedAt: null },
  });
  return count > 0;
}

// Returns true if the channelId belongs to the organization.
export async function channelExistsInOrg(channelId, organizationId) {
  const count = await prisma.notificationChannel.count({
    where: { id: channelId, organizationId },
  });
  return count > 0;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function createUptimeAlertRule(data) {
  return prisma.uptimeAlertRule.create({ data, select: ruleSelect });
}

export async function listUptimeAlertRules(organizationId, { serviceId, isActive, limit = 50, offset = 0 } = {}) {
  const where = { organizationId };
  if (serviceId !== undefined) where.serviceId = serviceId;
  if (isActive  !== undefined) where.isActive  = isActive;

  const [rules, total] = await Promise.all([
    prisma.uptimeAlertRule.findMany({
      where, select: ruleSelect,
      orderBy: { createdAt: 'desc' },
      take: limit, skip: offset,
    }),
    prisma.uptimeAlertRule.count({ where }),
  ]);
  return { rules, total };
}

export async function findUptimeAlertRule(id, organizationId) {
  return prisma.uptimeAlertRule.findFirst({ where: { id, organizationId }, select: ruleSelect });
}

export async function updateUptimeAlertRule(id, organizationId, data) {
  return prisma.uptimeAlertRule.updateMany({ where: { id, organizationId }, data });
}

export async function deleteUptimeAlertRule(id, organizationId) {
  return prisma.uptimeAlertRule.deleteMany({ where: { id, organizationId } });
}

// ─── Engine helpers (used by uptimeAlerts.js) ─────────────────────────────────

// Load active rules that apply to a given service (serviceId-specific + org-wide).
export async function loadActiveRulesForService(organizationId, serviceId) {
  return prisma.uptimeAlertRule.findMany({
    where: {
      organizationId,
      isActive: true,
      OR: [
        { serviceId },
        { serviceId: null },
      ],
    },
    select: {
      ...ruleSelect,
      // Include cooldownSeconds and lastFiredAt for evaluation
      cooldownSeconds: true,
      lastFiredAt: true,
      lastResolvedAt: true,
    },
  });
}

export async function updateUptimeRuleFiredAt(id, organizationId, firedAt) {
  return prisma.uptimeAlertRule.updateMany({
    where: { id, organizationId },
    data: { lastFiredAt: firedAt },
  });
}

export async function updateUptimeRuleResolvedAt(id, organizationId, resolvedAt) {
  return prisma.uptimeAlertRule.updateMany({
    where: { id, organizationId },
    data: { lastResolvedAt: resolvedAt },
  });
}
