import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { buildTimestampCursorWhere, encodeTelemetryCursor } from '../../utils/telemetryCursor.js';

const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const MAX_STATS_ROWS = 2_500;

function countMap(groups) {
  const counts = Object.fromEntries(LOG_LEVELS.map((level) => [level, 0]));
  for (const group of groups) {
    counts[group.level] = group._count?._all ?? 0;
  }
  return counts;
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

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

export async function serviceExistsInOrg(organizationId, serviceId) {
  const count = await prisma.monitoredService.count({
    where: { id: serviceId, organizationId, deletedAt: null },
  });
  return count > 0;
}

export async function getLogStats(organizationId, opts = {}) {
  const {
    serviceId,
    level,
    from,
    to,
    bucketSeconds,
    limit = MAX_STATS_ROWS,
  } = opts;

  const filters = [
    Prisma.sql`organizationId = ${organizationId}`,
    Prisma.sql`timestamp >= ${from}`,
    Prisma.sql`timestamp <= ${to}`,
  ];
  if (serviceId) filters.push(Prisma.sql`serviceId = ${serviceId}`);
  if (level) filters.push(Prisma.sql`level = ${level}`);

  const where = {
    organizationId,
    ...(serviceId && { serviceId }),
    ...(level && { level }),
    timestamp: { gte: from, lte: to },
  };

  const [seriesRows, totals, topServiceRows] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ${bucketSeconds}) * ${bucketSeconds}) AS bucketStart,
        level,
        COUNT(*) AS count
      FROM log_entries
      WHERE ${Prisma.join(filters, ' AND ')}
      GROUP BY bucketStart, level
      ORDER BY bucketStart ASC
      LIMIT ${limit}
    `,
    prisma.logEntry.groupBy({
      by: ['level'],
      where,
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT serviceId, COUNT(*) AS count
      FROM log_entries
      WHERE ${Prisma.join([...filters, Prisma.sql`serviceId IS NOT NULL`], ' AND ')}
      GROUP BY serviceId
      ORDER BY count DESC
      LIMIT 5
    `,
  ]);

  const totalByLevel = countMap(totals);

  return {
    series: seriesRows.map((row) => ({
      bucketStart: normalizeDate(row.bucketStart),
      level: row.level,
      count: Number(row.count ?? 0),
    })),
    totalsByLevel: totalByLevel,
    topServices: topServiceRows.map((row) => ({
      serviceId: row.serviceId,
      count: Number(row.count ?? 0),
    })),
    errorCount: (totalByLevel.ERROR ?? 0) + (totalByLevel.FATAL ?? 0),
  };
}

export { MAX_STATS_ROWS };
