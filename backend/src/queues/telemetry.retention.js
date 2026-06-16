#!/usr/bin/env node
/**
 * Telemetry retention cleanup — run with: npm run telemetry:cleanup
 *
 * Deletes LogEntry and MetricSample rows older than the configured retention
 * window. Runs in batches to avoid long-running DELETE statements.
 */

import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';

const { logRetentionDays, metricRetentionDays, retentionBatchSize } = env.telemetry;

async function deleteOldLogs(cutoff, batchSize) {
  let total = 0;
  let deleted;
  do {
    const ids = await prisma.logEntry.findMany({
      where: { timestamp: { lt: cutoff } },
      select: { id: true },
      take: batchSize,
    });
    if (ids.length === 0) break;
    const result = await prisma.logEntry.deleteMany({
      where: { id: { in: ids.map((r) => r.id) } },
    });
    deleted = result.count;
    total += deleted;
    console.log(`  [logs] deleted batch of ${deleted}`);
  } while (deleted === batchSize);
  return total;
}

async function deleteOldMetrics(cutoff, batchSize) {
  let total = 0;
  let deleted;
  do {
    const ids = await prisma.metricSample.findMany({
      where: { timestamp: { lt: cutoff } },
      select: { id: true },
      take: batchSize,
    });
    if (ids.length === 0) break;
    const result = await prisma.metricSample.deleteMany({
      where: { id: { in: ids.map((r) => r.id) } },
    });
    deleted = result.count;
    total += deleted;
    console.log(`  [metrics] deleted batch of ${deleted}`);
  } while (deleted === batchSize);
  return total;
}

async function main() {
  const now = Date.now();
  const logCutoff    = new Date(now - logRetentionDays    * 86_400_000);
  const metricCutoff = new Date(now - metricRetentionDays * 86_400_000);

  console.log(`Telemetry retention cleanup — ${new Date().toISOString()}`);
  console.log(`  log cutoff:    ${logCutoff.toISOString()} (${logRetentionDays}d)`);
  console.log(`  metric cutoff: ${metricCutoff.toISOString()} (${metricRetentionDays}d)`);
  console.log(`  batch size:    ${retentionBatchSize}`);

  const logsDeleted    = await deleteOldLogs(logCutoff, retentionBatchSize);
  const metricsDeleted = await deleteOldMetrics(metricCutoff, retentionBatchSize);

  console.log(`Done — logs: ${logsDeleted}, metrics: ${metricsDeleted}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Retention cleanup failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
