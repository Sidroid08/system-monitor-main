import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'bullmq';
import prisma from '../lib/prisma.js';
import { env } from '../config/env.js';
import { closeRedisConnection, createRedisConnection, requireRedisUrl } from './connection.js';
import { makeUptimeQueue, UPTIME_QUEUE_NAME } from './uptime.queue.js';
import { startUptimeScheduler } from './uptime.scheduler.js';
import {
  createUptimeCheck,
  findServiceById,
} from '../modules/services/services.repository.js';
import { performHttpCheck } from '../modules/services/services.health.js';
import { handleUptimeStateChange } from '../lib/uptimeAlerts.js';

function parseJobData(data) {
  if (!data?.organizationId || !data?.serviceId) {
    throw new Error('Invalid uptime check job payload');
  }
  const source = typeof data.source === 'string' && /^[a-z0-9_-]{1,40}$/i.test(data.source)
    ? data.source
    : 'scheduler';
  return {
    organizationId: data.organizationId,
    serviceId: data.serviceId,
    requestedBy: data.requestedBy ?? 'system',
    source,
  };
}

export async function processUptimeCheckJob(job, deps = {}) {
  const {
    repo = { findServiceById, createUptimeCheck },
    checker = performHttpCheck,
    onCheckStored = async () => {},
  } = deps;

  const { organizationId, serviceId, source } = parseJobData(job.data);
  const service = await repo.findServiceById(serviceId, organizationId);
  if (!service) {
    return { skipped: true, reason: 'service_not_found', organizationId, serviceId };
  }
  if (!service.isActive || service.deletedAt) {
    return { skipped: true, reason: 'service_inactive', organizationId, serviceId };
  }

  const result = await checker(service, { checkSource: source });
  const check = await repo.createUptimeCheck(organizationId, service.id, {
    ...result,
    checkSource: source,
  });

  await onCheckStored({ service, check, source });

  return {
    skipped: false,
    organizationId,
    serviceId,
    checkId: check.id,
    status: check.status,
  };
}

export function makeUptimeWorker({
  WorkerImpl = Worker,
  connection = createRedisConnection(),
  concurrency = env.uptime.workerConcurrency,
  processorDeps = {},
} = {}) {
  return new WorkerImpl(
    UPTIME_QUEUE_NAME,
    (job) => processUptimeCheckJob(job, processorDeps),
    {
      connection,
      concurrency,
    },
  );
}

async function bootstrapWorker({ withScheduler = false } = {}) {
  requireRedisUrl();
  await prisma.$connect();

  const workerConnection = createRedisConnection();
  const worker = makeUptimeWorker({
    connection: workerConnection,
    processorDeps: {
      onCheckStored: (ctx) => handleUptimeStateChange(ctx),
    },
  });
  let schedulerConnection;
  let schedulerQueue;
  let scheduler;

  worker.on('completed', (job, result) => {
    console.log(`Uptime job completed: ${job.id}`, result);
  });
  worker.on('failed', (job, error) => {
    console.error(`Uptime job failed: ${job?.id ?? 'unknown'}`, error);
  });

  if (withScheduler) {
    schedulerConnection = createRedisConnection();
    schedulerQueue = makeUptimeQueue({ connection: schedulerConnection });
    scheduler = startUptimeScheduler({ queue: schedulerQueue });
  }

  async function shutdown(signal) {
    console.log(`Uptime worker shutdown signal received: ${signal}`);
    scheduler?.close();
    await schedulerQueue?.close();
    await worker.close();
    await closeRedisConnection(schedulerConnection);
    await closeRedisConnection(workerConnection);
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log(`Uptime worker started with concurrency ${env.uptime.workerConcurrency}`);
  if (withScheduler) {
    console.log(`Uptime scheduler co-located every ${env.uptime.schedulerIntervalSeconds}s`);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : null;

if (invokedFile && path.resolve(currentFile) === invokedFile) {
  bootstrapWorker({ withScheduler: process.argv.includes('--with-scheduler') })
    .catch(async (error) => {
      console.error('Failed to start uptime worker', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
