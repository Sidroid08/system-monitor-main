import prisma from '../../lib/prisma.js';

export async function listMetrics(organizationId, opts = {}) {
  const { serviceId, name, type, from, to, cursor, limit = 50 } = opts;

  const where = {
    organizationId,
    ...(serviceId  && { serviceId }),
    ...(name       && { name }),
    ...(type       && { type }),
    ...(from || to ? { timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    ...(cursor     && { id: { lt: cursor } }),
  };

  const rows = await prisma.metricSample.findMany({
    where,
    orderBy: { timestamp: 'desc' },
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return { rows, nextCursor: hasMore ? rows[rows.length - 1]?.id : null };
}

export async function listMetricNames(organizationId, opts = {}) {
  const { serviceId, prefix } = opts;

  const where = {
    organizationId,
    ...(serviceId && { serviceId }),
    ...(prefix    && { name: { startsWith: prefix } }),
  };

  const result = await prisma.metricSample.findMany({
    where,
    distinct: ['name'],
    select: { name: true },
    orderBy: { name: 'asc' },
    take: 1000,
  });

  return result.map((r) => r.name);
}
