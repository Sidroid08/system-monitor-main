import prisma from '../../lib/prisma.js';

const instanceInclude = {
  awsAccount: { select: { id: true, accountName: true, accountId: true, region: true } },
  organization: { select: { id: true, name: true, slug: true } },
};

export async function listInstances({ organizationId = null, limit = 50, offset = 0 } = {}) {
  const where = organizationId ? { organizationId } : undefined;

  const [instances, total] = await Promise.all([
    prisma.monitoredInstance.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: instanceInclude,
      take: limit,
      skip: offset,
    }),
    prisma.monitoredInstance.count({ where }),
  ]);

  return { instances, total };
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

// After a full sync, flip any instance not in seenInstanceIds to TERMINATED.
export async function markInstancesTerminated(awsAccountId, seenInstanceIds) {
  if (!seenInstanceIds.length) return;
  return prisma.monitoredInstance.updateMany({
    where: {
      awsAccountId,
      instanceId: { notIn: seenInstanceIds },
      status: { not: 'TERMINATED' },
    },
    data: { status: 'TERMINATED' },
  });
}
