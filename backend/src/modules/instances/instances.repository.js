import prisma from '../../lib/prisma.js';

export async function listInstances({ organizationId = null } = {}) {
  return prisma.monitoredInstance.findMany({
    where: organizationId ? { organizationId } : undefined,
    orderBy: { updatedAt: 'desc' },
    include: {
      awsAccount: {
        select: {
          id: true,
          accountName: true,
          accountId: true,
          region: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
}

export async function upsertInstance(instance) {
  return prisma.monitoredInstance.upsert({
    where: {
      organizationId_instanceId: {
        organizationId: instance.organizationId,
        instanceId: instance.instanceId,
      },
    },
    update: {
      awsAccountId: instance.awsAccountId ?? null,
      instanceName: instance.instanceName ?? null,
      hostname: instance.hostname ?? null,
      privateIp: instance.privateIp ?? null,
      publicIp: instance.publicIp ?? null,
      platform: instance.platform ?? 'LINUX',
      serviceType: instance.serviceType ?? 'EC2',
      region: instance.region ?? null,
      status: instance.status ?? 'UNKNOWN',
      orgLabel: instance.orgLabel ?? null,
      serviceLabel: instance.serviceLabel ?? null,
      lastSeenAt: instance.lastSeenAt ?? new Date(),
    },
    create: {
      organizationId: instance.organizationId,
      awsAccountId: instance.awsAccountId ?? null,
      instanceId: instance.instanceId,
      instanceName: instance.instanceName ?? null,
      hostname: instance.hostname ?? null,
      privateIp: instance.privateIp ?? null,
      publicIp: instance.publicIp ?? null,
      platform: instance.platform ?? 'LINUX',
      serviceType: instance.serviceType ?? 'EC2',
      region: instance.region ?? null,
      status: instance.status ?? 'UNKNOWN',
      orgLabel: instance.orgLabel ?? null,
      serviceLabel: instance.serviceLabel ?? null,
      lastSeenAt: instance.lastSeenAt ?? new Date(),
    },
  });
}