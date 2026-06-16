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
      },
    });

    return check;
  });
}
