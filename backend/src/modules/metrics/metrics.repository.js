import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma.js';
import { buildTimestampCursorWhere, encodeTelemetryCursor } from '../../utils/telemetryCursor.js';

const MAX_AGGREGATE_ROWS = 2_000;

function metricAggregationSql(aggregation) {
  switch (aggregation) {
    case 'avg':
      return Prisma.sql`AVG(value)`;
    case 'min':
      return Prisma.sql`MIN(value)`;
    case 'max':
      return Prisma.sql`MAX(value)`;
    case 'sum':
      return Prisma.sql`SUM(value)`;
    case 'count':
      return Prisma.sql`COUNT(*)`;
    default:
      return Prisma.sql`AVG(value)`;
  }
}

function groupColumns(groupBy) {
  return groupBy.map((field) => {
    if (field === 'serviceId') return Prisma.sql`serviceId`;
    return Prisma.sql`name`;
  });
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

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

export async function serviceExistsInOrg(organizationId, serviceId) {
  const count = await prisma.monitoredService.count({
    where: { id: serviceId, organizationId, deletedAt: null },
  });
  return count > 0;
}

export async function aggregateMetrics(organizationId, opts = {}) {
  const {
    serviceId,
    name,
    from,
    to,
    bucketSeconds,
    aggregation,
    groupBy = [],
    limit = MAX_AGGREGATE_ROWS,
  } = opts;

  const filters = [
    Prisma.sql`organizationId = ${organizationId}`,
    Prisma.sql`timestamp >= ${from}`,
    Prisma.sql`timestamp <= ${to}`,
  ];
  if (serviceId) filters.push(Prisma.sql`serviceId = ${serviceId}`);
  if (name) filters.push(Prisma.sql`name = ${name}`);

  const columns = groupColumns(groupBy);
  const selectGroups = columns.length ? Prisma.sql`, ${Prisma.join(columns)}` : Prisma.empty;
  const groupGroups = columns.length ? Prisma.sql`, ${Prisma.join(columns)}` : Prisma.empty;
  const aggregateSql = metricAggregationSql(aggregation);

  const rows = await prisma.$queryRaw`
    SELECT
      FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(timestamp) / ${bucketSeconds}) * ${bucketSeconds}) AS bucketStart
      ${selectGroups},
      ${aggregateSql} AS value,
      COUNT(*) AS sampleCount
    FROM metric_samples
    WHERE ${Prisma.join(filters, ' AND ')}
    GROUP BY bucketStart ${groupGroups}
    ORDER BY bucketStart ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    bucketStart: normalizeDate(row.bucketStart),
    ...(groupBy.includes('serviceId') && { serviceId: row.serviceId }),
    ...(groupBy.includes('name') && { name: row.name }),
    value: Number(row.value ?? 0),
    sampleCount: Number(row.sampleCount ?? 0),
  }));
}

export { MAX_AGGREGATE_ROWS };
