import prisma from '../../lib/prisma.js';
import { buildTimestampCursorWhere, encodeTelemetryCursor } from '../../utils/telemetryCursor.js';

export async function listMetrics(organizationId, opts = {}) {
  const { serviceId, name, type, from, to, cursor, limit = 50 } = opts;

  const cursorWhere = buildTimestampCursorWhere(cursor);
  const where = {
    organizationId,
    ...(serviceId  && { serviceId }),
    ...(name       && { name }),
    ...(type       && { type }),
    ...(from || to ? { timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    ...(cursorWhere && { AND: [cursorWhere] }),
  };

  const rows = await prisma.metricSample.findMany({
    where,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return { rows, nextCursor: hasMore ? encodeTelemetryCursor(rows[rows.length - 1]) : null };
}

export { encodeTelemetryCursor };

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
