import prisma from '../../lib/prisma.js';
import { env } from '../../config/env.js';

const SERVICE_STATUSES = ['UP', 'DOWN', 'DEGRADED', 'UNKNOWN'];
const LOG_LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];
const ACTIVE_ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED'];
const ACTIVE_INCIDENT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING'];

function countMap(groups, key, defaults = []) {
  const counts = Object.fromEntries(defaults.map((value) => [value, 0]));
  for (const group of groups) {
    counts[group[key]] = group._count?._all ?? 0;
  }
  return counts;
}

function normalizeDate(value) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value);
}

async function getUptimeSummary(organizationId, from, to, serviceId = undefined) {
  const where = {
    organizationId,
    ...(serviceId && { serviceId }),
    checkedAt: { gte: from, lte: to },
  };

  const groups = await prisma.uptimeCheck.groupBy({
    by: ['status'],
    where,
    _count: { _all: true },
  });

  const byStatus = countMap(groups, 'status', SERVICE_STATUSES);
  const totalChecks = Object.values(byStatus).reduce((sum, count) => sum + count, 0);
  const upChecks = byStatus.UP ?? 0;

  return {
    percentage: totalChecks === 0 ? null : Number(((upChecks / totalChecks) * 100).toFixed(2)),
    totalChecks,
    upChecks,
    byStatus,
  };
}

export async function getOverview(organizationId, { from, to }) {
  const servicesWhere = { organizationId, deletedAt: null };
  const telemetryWindow = { gte: from, lte: to };

  const [
    totalServices,
    servicesByStatus,
    activeAlertsCount,
    openIncidentsCount,
    averageResponse,
    uptime,
    logsByLevel,
    metricsCount,
    recentIncidents,
    recentAlerts,
  ] = await Promise.all([
    prisma.monitoredService.count({ where: servicesWhere }),
    prisma.monitoredService.groupBy({
      by: ['currentStatus'],
      where: servicesWhere,
      _count: { _all: true },
    }),
    prisma.alert.count({
      where: { organizationId, status: { in: ACTIVE_ALERT_STATUSES } },
    }),
    prisma.incident.count({
      where: { organizationId, status: { in: ACTIVE_INCIDENT_STATUSES } },
    }),
    prisma.uptimeCheck.aggregate({
      where: {
        organizationId,
        checkedAt: telemetryWindow,
        responseTimeMs: { not: null },
      },
      _avg: { responseTimeMs: true },
    }),
    getUptimeSummary(organizationId, from, to),
    prisma.logEntry.groupBy({
      by: ['level'],
      where: { organizationId, timestamp: telemetryWindow },
      _count: { _all: true },
    }),
    prisma.metricSample.count({
      where: { organizationId, timestamp: telemetryWindow },
    }),
    prisma.incident.findMany({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        serviceId: true,
        title: true,
        severity: true,
        status: true,
        source: true,
        startedAt: true,
        resolvedAt: true,
      },
    }),
    prisma.alert.findMany({
      where: { organizationId },
      orderBy: { triggeredAt: 'desc' },
      take: 5,
      select: {
        id: true,
        ruleId: true,
        title: true,
        severity: true,
        source: true,
        metricName: true,
        status: true,
        triggeredAt: true,
        resolvedAt: true,
      },
    }),
  ]);

  return {
    window: { from: from.toISOString(), to: to.toISOString(), label: '24h' },
    services: {
      total: totalServices,
      byStatus: countMap(servicesByStatus, 'currentStatus', SERVICE_STATUSES),
    },
    alerts: { active: activeAlertsCount, recent: recentAlerts },
    incidents: { open: openIncidentsCount, recent: recentIncidents },
    uptime: {
      percentage: uptime.percentage,
      totalChecks: uptime.totalChecks,
      byStatus: uptime.byStatus,
    },
    responseTime: {
      averageMs: averageResponse._avg.responseTimeMs === null
        ? null
        : Number(averageResponse._avg.responseTimeMs.toFixed(2)),
    },
    logs: { byLevel: countMap(logsByLevel, 'level', LOG_LEVELS) },
    metrics: { samples: metricsCount },
  };
}

export async function getRetentionStatus() {
  return {
    logRetentionDays: env.telemetry.logRetentionDays,
    metricRetentionDays: env.telemetry.metricRetentionDays,
    retentionBatchSize: env.telemetry.retentionBatchSize,
    cleanupScript: 'npm run telemetry:cleanup',
    mode: 'manual',
  };
}

export async function findServiceForSummary(serviceId, organizationId) {
  return prisma.monitoredService.findFirst({
    where: { id: serviceId, organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      type: true,
      environment: true,
      url: true,
      healthPath: true,
      method: true,
      expectedStatusCode: true,
      timeoutMs: true,
      intervalSeconds: true,
      isActive: true,
      currentStatus: true,
      lastCheckedAt: true,
      lastResponseTimeMs: true,
      nextCheckAt: true,
      lastCheckSource: true,
      consecutiveFailures: true,
      consecutiveSuccesses: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getLatestUptimeCheck(organizationId, serviceId) {
  return prisma.uptimeCheck.findFirst({
    where: { organizationId, serviceId },
    orderBy: { checkedAt: 'desc' },
  });
}

export async function getResponseTimeSeries(organizationId, serviceId, { from, to, bucketSeconds, limit }) {
  const rows = await prisma.$queryRaw`
    SELECT
      FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(checkedAt) / ${bucketSeconds}) * ${bucketSeconds}) AS bucketStart,
      AVG(responseTimeMs) AS averageMs,
      MIN(responseTimeMs) AS minMs,
      MAX(responseTimeMs) AS maxMs,
      COUNT(responseTimeMs) AS sampleCount
    FROM uptime_checks
    WHERE organizationId = ${organizationId}
      AND serviceId = ${serviceId}
      AND checkedAt >= ${from}
      AND checkedAt <= ${to}
      AND responseTimeMs IS NOT NULL
    GROUP BY bucketStart
    ORDER BY bucketStart ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    bucketStart: normalizeDate(row.bucketStart),
    averageMs: toNumber(row.averageMs),
    minMs: toNumber(row.minMs),
    maxMs: toNumber(row.maxMs),
    sampleCount: Number(row.sampleCount ?? 0),
  }));
}

export async function getStatusHistory(organizationId, serviceId, { from, to, bucketSeconds, limit }) {
  const rows = await prisma.$queryRaw`
    SELECT
      FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP(checkedAt) / ${bucketSeconds}) * ${bucketSeconds}) AS bucketStart,
      status,
      COUNT(*) AS count
    FROM uptime_checks
    WHERE organizationId = ${organizationId}
      AND serviceId = ${serviceId}
      AND checkedAt >= ${from}
      AND checkedAt <= ${to}
    GROUP BY bucketStart, status
    ORDER BY bucketStart ASC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    bucketStart: normalizeDate(row.bucketStart),
    status: row.status,
    count: Number(row.count ?? 0),
  }));
}

export async function getServiceLogCountsByLevel(organizationId, serviceId, { from, to }) {
  const groups = await prisma.logEntry.groupBy({
    by: ['level'],
    where: {
      organizationId,
      serviceId,
      timestamp: { gte: from, lte: to },
    },
    _count: { _all: true },
  });
  return countMap(groups, 'level', LOG_LEVELS);
}

export async function getRecentServiceLogs(organizationId, serviceId, limit = 20) {
  return prisma.logEntry.findMany({
    where: { organizationId, serviceId },
    orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    take: limit,
    select: {
      id: true,
      level: true,
      message: true,
      timestamp: true,
      source: true,
      environment: true,
      traceId: true,
      requestId: true,
    },
  });
}

export async function getRecentServiceAlerts(organizationId, serviceId, limit = 10) {
  return prisma.alert.findMany({
    where: {
      organizationId,
      labels: { contains: `"serviceId":"${serviceId}"` },
    },
    orderBy: { triggeredAt: 'desc' },
    take: limit,
    select: {
      id: true,
      ruleId: true,
      title: true,
      severity: true,
      source: true,
      metricName: true,
      status: true,
      triggeredAt: true,
      resolvedAt: true,
    },
  });
}

export async function getRecentServiceIncidents(organizationId, serviceId, limit = 10) {
  return prisma.incident.findMany({
    where: { organizationId, serviceId },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      alertId: true,
      alertRuleId: true,
      title: true,
      severity: true,
      status: true,
      source: true,
      startedAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      closedAt: true,
    },
  });
}

export async function getServiceSummary(organizationId, serviceId, { from, to, bucketSeconds, bucketLimit }) {
  const service = await findServiceForSummary(serviceId, organizationId);
  if (!service) return null;
  const { url, healthPath, ...safeService } = service;

  const now = new Date();
  const last24hFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7dFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    latestUptimeCheck,
    uptime24h,
    uptime7d,
    responseTimeSeries,
    statusHistory,
    logCountsByLevel,
    recentLogs,
    recentAlerts,
    recentIncidents,
  ] = await Promise.all([
    getLatestUptimeCheck(organizationId, serviceId),
    getUptimeSummary(organizationId, last24hFrom, now, serviceId),
    getUptimeSummary(organizationId, last7dFrom, now, serviceId),
    getResponseTimeSeries(organizationId, serviceId, { from, to, bucketSeconds, limit: bucketLimit }),
    getStatusHistory(organizationId, serviceId, { from, to, bucketSeconds, limit: bucketLimit * SERVICE_STATUSES.length }),
    getServiceLogCountsByLevel(organizationId, serviceId, { from, to }),
    getRecentServiceLogs(organizationId, serviceId, 20),
    getRecentServiceAlerts(organizationId, serviceId, 10),
    getRecentServiceIncidents(organizationId, serviceId, 10),
  ]);

  return {
    service: {
      ...safeService,
      hasUrl: Boolean(url),
      hasHealthPath: Boolean(healthPath),
    },
    latestUptimeCheck,
    uptime: {
      last24h: uptime24h,
      last7d: uptime7d,
    },
    responseTimeSeries,
    statusHistory,
    logs: {
      byLevel: logCountsByLevel,
      recent: recentLogs,
    },
    alerts: {
      recent: recentAlerts,
    },
    incidents: {
      recent: recentIncidents,
    },
  };
}
