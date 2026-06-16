import prisma from '../../lib/prisma.js';

const alertSelect = {
  id: true, organizationId: true, ruleId: true,
  title: true, description: true, severity: true,
  source: true, metricName: true, instanceId: true,
  status: true, triggeredAt: true, resolvedAt: true,
  labels: true, createdAt: true, updatedAt: true,
};

export async function listAlerts(organizationId, { status, severity, ruleId, source, limit = 50, offset = 0 } = {}) {
  const where = { organizationId };
  if (status)   where.status   = status;
  if (severity) where.severity = severity;
  if (ruleId)   where.ruleId   = ruleId;
  if (source)   where.source   = source;

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where, select: alertSelect,
      orderBy: { triggeredAt: 'desc' },
      take: limit, skip: offset,
    }),
    prisma.alert.count({ where }),
  ]);
  return { alerts, total };
}

export async function findAlert(id, organizationId) {
  return prisma.alert.findFirst({ where: { id, organizationId }, select: alertSelect });
}

export async function updateAlertStatus(id, organizationId, status) {
  const data = { status };
  if (status === 'RESOLVED') data.resolvedAt = new Date();
  return prisma.alert.updateMany({ where: { id, organizationId }, data });
}

export async function createAlert(data) {
  return prisma.alert.create({ data, select: alertSelect });
}

// Resolve all open uptime alerts for a given service when it recovers.
// Labels field stores JSON like {"serviceId":"<uuid>",...}; contains match is safe for UUIDs.
export async function resolveOpenUptimeAlerts(organizationId, serviceId) {
  return prisma.alert.updateMany({
    where: {
      organizationId,
      source: 'uptime-check',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      labels: { contains: `"serviceId":"${serviceId}"` },
    },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}

// Returns true if an open/acknowledged uptime alert already exists for this service.
export async function hasOpenUptimeAlert(organizationId, serviceId) {
  const count = await prisma.alert.count({
    where: {
      organizationId,
      source: 'uptime-check',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      labels: { contains: `"serviceId":"${serviceId}"` },
    },
  });
  return count > 0;
}

// Find an open alert that was fired by a specific UptimeAlertRule.
export async function findOpenAlertForRule(organizationId, uptimeRuleId) {
  return prisma.alert.findFirst({
    where: {
      organizationId,
      source: 'uptime-rule',
      status: { in: ['OPEN', 'ACKNOWLEDGED'] },
      labels: { contains: `"uptimeRuleId":"${uptimeRuleId}"` },
    },
    select: alertSelect,
  });
}

// Resolve a single alert by id (used when a rule's condition clears).
export async function resolveAlertById(id, organizationId) {
  return prisma.alert.updateMany({
    where: { id, organizationId },
    data: { status: 'RESOLVED', resolvedAt: new Date() },
  });
}
