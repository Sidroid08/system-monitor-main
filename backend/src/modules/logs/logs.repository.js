import prisma from '../../lib/prisma.js';
import { buildTimestampCursorWhere, encodeTelemetryCursor } from '../../utils/telemetryCursor.js';

export async function listLogs(organizationId, opts = {}) {
  const {
    serviceId,
    level,
    environment,
    traceId,
    from,
    to,
    search,
    cursor,
    limit = 50,
  } = opts;

  const cursorWhere = buildTimestampCursorWhere(cursor);
  const where = {
    organizationId,
    ...(serviceId    && { serviceId }),
    ...(level        && { level }),
    ...(environment  && { environment }),
    ...(traceId      && { traceId }),
    ...(from || to   ? { timestamp: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    ...(search       && { message: { contains: search } }),
    ...(cursorWhere  && { AND: [cursorWhere] }),
  };

  const rows = await prisma.logEntry.findMany({
    where,
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });

  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();

  return { rows, nextCursor: hasMore ? encodeTelemetryCursor(rows[rows.length - 1]) : null };
}

export { encodeTelemetryCursor };

export async function findLogById(id, organizationId) {
  return prisma.logEntry.findFirst({ where: { id, organizationId } });
}
