import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { closeRedisConnection, createRedisConnection } from './connection.js';
import {
  buildUptimeJobData,
  buildUptimeJobId,
  makeUptimeQueue,
  UPTIME_JOB_NAME,
  UPTIME_JOB_OPTIONS,
} from './uptime.queue.js';

export const SCHEDULABLE_SERVICE_TYPES = Object.freeze(['HTTP', 'API', 'WEB']);

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.floor(number);
}

function toDate(value) {
  return value ? new Date(value) : null;
}

export function calculateNextCheckAt(service, from = new Date()) {
  const intervalSeconds = normalizePositiveInteger(service.intervalSeconds, 60);
  return new Date(from.getTime() + intervalSeconds * 1000);
}

export function isServiceDueForCheck(service, now = new Date()) {
  if (!service?.isActive || service.deletedAt) return false;
  if (!SCHEDULABLE_SERVICE_TYPES.includes(service.type)) return false;

  const nextCheckAt = toDate(service.nextCheckAt);
  if (nextCheckAt) {
    return nextCheckAt.getTime() <= now.getTime();
  }

  const lastCheckedAt = toDate(service.lastCheckedAt);
  if (!lastCheckedAt) return true;

  return calculateNextCheckAt(service, lastCheckedAt).getTime() <= now.getTime();
}

export async function findDueServices({
  prismaClient = prisma,
  now = new Date(),
  limit = env.uptime.schedulerScanLimit,
} = {}) {
  const take = Math.min(normalizePositiveInteger(limit, 100), 1000);
  const candidates = await prismaClient.monitoredService.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      type: { in: [...SCHEDULABLE_SERVICE_TYPES] },
      OR: [
        { nextCheckAt: null },
        { nextCheckAt: { lte: now } },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      type: true,
      intervalSeconds: true,
      isActive: true,
      deletedAt: true,
      lastCheckedAt: true,
      nextCheckAt: true,
    },
    orderBy: [
      { nextCheckAt: 'asc' },
      { lastCheckedAt: 'asc' },
    ],
    take,
  });

  return candidates.filter((service) => isServiceDueForCheck(service, now));
}

function isDuplicateJobError(error) {
  return /already exists|job id/i.test(error?.message ?? '');
}

export async function enqueueDueUptimeChecks({
  queue,
  prismaClient = prisma,
  now = new Date(),
  limit = env.uptime.schedulerScanLimit,
  source = 'scheduler',
} = {}) {
  if (!queue) throw new Error('Uptime queue is required');

  const dueServices = await findDueServices({ prismaClient, now, limit });
  const summary = {
    scannedDue: dueServices.length,
    enqueued: 0,
    duplicate: 0,
    failed: 0,
  };

  for (const service of dueServices) {
    const jobId = buildUptimeJobId(service, now);
    try {
      await queue.add(UPTIME_JOB_NAME, buildUptimeJobData(service, source), {
        ...UPTIME_JOB_OPTIONS,
        jobId,
      });
      summary.enqueued += 1;
    } catch (error) {
      if (isDuplicateJobError(error)) {
        summary.duplicate += 1;
        continue;
      }
      summary.failed += 1;
      throw error;
    }
  }

  return summary;
}

export function startUptimeScheduler({
  queue,
  prismaClient = prisma,
  intervalSeconds = env.uptime.schedulerIntervalSeconds,
  limit = env.uptime.schedulerScanLimit,
  logger = console,
} = {}) {
  if (!queue) throw new Error('Uptime queue is required');

  const everyMs = normalizePositiveInteger(intervalSeconds, 15) * 1000;
  let running = false;

  async function runOnce() {
    if (running) return { skipped: true, reason: 'previous_cycle_running' };
    running = true;
    try {
      const summary = await enqueueDueUptimeChecks({ queue, prismaClient, limit });
      logger.info?.('Uptime scheduler cycle completed', summary);
      return summary;
    } catch (error) {
      logger.error?.('Uptime scheduler cycle failed', error);
      throw error;
    } finally {
      running = false;
    }
  }

  const timer = setInterval(() => {
    runOnce().catch(() => {});
  }, everyMs);
  timer.unref?.();

  runOnce().catch(() => {});

  return {
    timer,
    runOnce,
    close() {
      clearInterval(timer);
    },
  };
}

async function bootstrapScheduler() {
  const connection = createRedisConnection();
  const queue = makeUptimeQueue({ connection });
  let scheduler;

  async function shutdown(signal) {
    console.log(`Uptime scheduler shutdown signal received: ${signal}`);
    scheduler?.close();
    await queue.close();
    await closeRedisConnection(connection);
    await prisma.$disconnect();
    process.exit(0);
  }

  await prisma.$connect();
  scheduler = startUptimeScheduler({ queue });
  console.log(`Uptime scheduler started every ${env.uptime.schedulerIntervalSeconds}s`);

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedFile && path.resolve(currentFile) === invokedFile) {
  bootstrapScheduler().catch(async (error) => {
    console.error('Failed to start uptime scheduler', error);
    await prisma.$disconnect();
    process.exit(1);
  });
}
