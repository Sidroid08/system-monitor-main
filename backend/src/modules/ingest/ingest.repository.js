import prisma from '../../lib/prisma.js';

export async function insertLogBatch(records) {
  return prisma.logEntry.createMany({ data: records, skipDuplicates: false });
}

export async function insertMetricBatch(records) {
  return prisma.metricSample.createMany({ data: records, skipDuplicates: false });
}

export async function serviceExistsInOrg(serviceId, organizationId) {
  const svc = await prisma.monitoredService.findFirst({
    where: { id: serviceId, organizationId },
    select: { id: true },
  });
  return svc !== null;
}
