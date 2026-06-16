import prisma from '../../lib/prisma.js';
import { summarizeServiceHealth } from './services.health.js';

const serviceInclude = {
  uptimeChecks: {
    orderBy: { checkedAt: 'desc' },
    take: 1,
  },
};

function withHealth(service) {
  if (!service) return null;
  const { uptimeChecks = [], ...rest } = service;
  return summarizeServiceHealth(rest, uptimeChecks[0] ?? null);
}

function nextCheckAtFor(service, checkedAt) {
  const intervalSeconds = Number(service.intervalSeconds ?? 60);
  const safeIntervalSeconds = Number.isFinite(intervalSeconds) && intervalSeconds > 0
    ? Math.floor(intervalSeconds)
    : 60;
  return new Date(checkedAt.getTime() + safeIntervalSeconds * 1000);
}

function statusStreakUpdate(status) {
  if (status === 'UP') {
    return {
      consecutiveSuccesses: { increment: 1 },
      consecutiveFailures: 0,
    };
  }
  if (status === 'DOWN') {
    return {
      consecutiveFailures: { increment: 1 },
      consecutiveSuccesses: 0,
    };
  }
  return {
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
  };
}

export async function createService(data) {
  const service = await prisma.monitoredService.create({
    data,
    include: serviceInclude,
  });
  return withHealth(service);
}

export async function listServices(organizationId, { limit = 50, offset = 0 } = {}) {
  const where = { organizationId, deletedAt: null };
  const [services, total] = await Promise.all([
    prisma.monitoredService.findMany({
      where,
      include: serviceInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.monitoredService.count({ where }),
  ]);

  return { services: services.map(withHealth), total };
}

export async function findServiceById(id, organizationId) {
  const service = await prisma.monitoredService.findFirst({
    where: { id, organizationId, deletedAt: null },
    include: serviceInclude,
  });
  return withHealth(service);
}

export async function updateService(id, organizationId, data) {
  const result = await prisma.monitoredService.updateMany({
    where: { id, organizationId, deletedAt: null },
    data,
  });
  if (result.count === 0) return null;
  return findServiceById(id, organizationId);
}

export async function softDeleteService(id, organizationId) {
  const result = await prisma.monitoredService.updateMany({
    where: { id, organizationId, deletedAt: null },
    data: { deletedAt: new Date(), isActive: false },
  });
  return result.count;
}

export async function createUptimeCheck(organizationId, serviceId, result) {
  return prisma.$transaction(async (tx) => {
    const service = await tx.monitoredService.findFirst({
      where: { id: serviceId, organizationId, deletedAt: null },
      select: { id: true, intervalSeconds: true },
    });
    if (!service) {
      throw new Error('Monitored service not found for uptime check');
    }

    const check = await tx.uptimeCheck.create({
      data: {
        organizationId,
        serviceId,
        status: result.status,
        httpStatusCode: result.httpStatusCode ?? null,
        responseTimeMs: result.responseTimeMs ?? null,
        errorMessage: result.errorMessage ?? null,
        checkSource: result.checkSource ?? 'manual',
        metadata: result.metadata ?? undefined,
      },
    });

    await tx.monitoredService.update({
      where: { id: serviceId },
      data: {
        currentStatus: check.status,
        lastCheckedAt: check.checkedAt,
        lastResponseTimeMs: check.responseTimeMs,
        nextCheckAt: nextCheckAtFor(service, check.checkedAt),
        lastCheckSource: check.checkSource,
        ...statusStreakUpdate(check.status),
      },
    });

    return check;
  });
}
