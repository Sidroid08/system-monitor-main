import prisma from '../../lib/prisma.js';

const safeSelect = {
  id: true, organizationId: true, name: true, type: true,
  minSeverity: true, isActive: true, createdAt: true, updatedAt: true,
  // config is intentionally excluded from list/get responses — it may contain webhook URLs.
  // Expose a separate GET /api/notification-channels/:id/config endpoint if needed.
};

const deliverySelect = {
  ...safeSelect,
  config: true,
};

export async function createChannel({ organizationId, name, type, config, minSeverity }) {
  return prisma.notificationChannel.create({
    data: { organizationId, name, type, config: JSON.stringify(config), minSeverity },
    select: safeSelect,
  });
}

export async function listChannels(organizationId) {
  return prisma.notificationChannel.findMany({
    where: { organizationId },
    select: safeSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function findChannel(id, organizationId) {
  return prisma.notificationChannel.findFirst({ where: { id, organizationId }, select: safeSelect });
}

export async function findChannelForDelivery(id, organizationId) {
  return prisma.notificationChannel.findFirst({ where: { id, organizationId }, select: deliverySelect });
}

export async function updateChannel(id, organizationId, data) {
  return prisma.notificationChannel.updateMany({ where: { id, organizationId }, data });
}

export async function deleteChannel(id, organizationId) {
  return prisma.notificationChannel.deleteMany({ where: { id, organizationId } });
}
