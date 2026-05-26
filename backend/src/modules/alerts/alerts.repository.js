import prisma from '../../lib/prisma.js';

export async function listAlerts({ organizationId, status, severity, limit = 50 } = {}) {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (status) where.status = status;
  if (severity) where.severity = severity;

  return prisma.alert.findMany({
    where,
    orderBy: { triggeredAt: 'desc' },
    take: limit,
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function createAlert({ organizationId, title, description, severity = 'MEDIUM', source, metricName, instanceId }) {
  return prisma.alert.create({
    data: { organizationId, title, description: description ?? null, severity, source: source ?? null, metricName: metricName ?? null, instanceId: instanceId ?? null },
  });
}

export async function updateAlertStatus(id, status, resolvedAt = null) {
  return prisma.alert.update({
    where: { id },
    data: { status, ...(resolvedAt ? { resolvedAt } : {}) },
  });
}

export async function getDashboardStats(organizationId) {
  const orgFilter = organizationId ? { organizationId } : {};

  const [
    totalInstances,
    runningInstances,
    stoppedInstances,
    openAlerts,
    criticalAlerts,
    awsAccounts,
    lastInstance,
  ] = await Promise.all([
    prisma.monitoredInstance.count({ where: orgFilter }),
    prisma.monitoredInstance.count({ where: { ...orgFilter, status: 'RUNNING' } }),
    prisma.monitoredInstance.count({ where: { ...orgFilter, status: 'STOPPED' } }),
    prisma.alert.count({ where: { ...orgFilter, status: 'OPEN' } }),
    prisma.alert.count({ where: { ...orgFilter, status: 'OPEN', severity: 'CRITICAL' } }),
    prisma.awsAccount.count({ where: orgFilter }),
    prisma.monitoredInstance.findFirst({ where: orgFilter, orderBy: { lastSeenAt: 'desc' }, select: { lastSeenAt: true } }),
  ]);

  return {
    totalInstances,
    runningInstances,
    stoppedInstances,
    openAlerts,
    criticalAlerts,
    awsAccounts,
    lastSyncedAt: lastInstance?.lastSeenAt ?? null,
  };
}

export async function deleteAlert(id) {
  return prisma.alert.delete({
    where: { id },
  });
}
