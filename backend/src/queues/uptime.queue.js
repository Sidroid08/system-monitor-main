import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { closeRedisConnection, createRedisConnection } from './connection.js';

export const UPTIME_QUEUE_NAME = 'uptime-checks';
export const UPTIME_JOB_NAME = 'run-uptime-check';

export const UPTIME_JOB_OPTIONS = Object.freeze({
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000,
  },
  removeOnComplete: 1000,
  removeOnFail: 5000,
});

function normalizeIntervalSeconds(intervalSeconds) {
  const seconds = Number(intervalSeconds ?? 60);
  if (!Number.isFinite(seconds) || seconds <= 0) return 60;
  return Math.max(30, Math.floor(seconds));
}

export function buildUptimeJobId(service, now = new Date()) {
  const intervalMs = normalizeIntervalSeconds(service.intervalSeconds) * 1000;
  const bucketStart = Math.floor(now.getTime() / intervalMs) * intervalMs;
  return `uptime:${service.id}:${bucketStart}`;
}

export function buildUptimeJobData(service, source = 'scheduler') {
  return {
    organizationId: service.organizationId,
    serviceId: service.id,
    requestedBy: 'system',
    source,
  };
}

export function makeUptimeQueue({ QueueImpl = Queue, connection = createRedisConnection() } = {}) {
  return new QueueImpl(UPTIME_QUEUE_NAME, {
    connection,
    defaultJobOptions: UPTIME_JOB_OPTIONS,
  });
}

export async function getUptimeQueueDiagnostics({
  queueFactory = makeUptimeQueue,
  connectionFactory = createRedisConnection,
} = {}) {
  if (!env.redis.url) {
    return {
      redis: {
        configured: false,
        ok: false,
        status: 'not_configured',
        error: 'REDIS_URL is not set',
      },
      queue: {
        name: UPTIME_QUEUE_NAME,
        counts: null,
      },
      scheduler: {
        intervalSeconds: env.uptime.schedulerIntervalSeconds,
        scanLimit: env.uptime.schedulerScanLimit,
        workerConcurrency: env.uptime.workerConcurrency,
      },
    };
  }

  const connection = connectionFactory();
  const queue = queueFactory({ connection });
  try {
    const [pong, counts] = await Promise.all([
      connection.ping(),
      queue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed', 'paused'),
    ]);

    return {
      redis: {
        configured: true,
        ok: pong === 'PONG',
        status: connection.status,
        error: null,
      },
      queue: {
        name: UPTIME_QUEUE_NAME,
        counts,
      },
      scheduler: {
        intervalSeconds: env.uptime.schedulerIntervalSeconds,
        scanLimit: env.uptime.schedulerScanLimit,
        workerConcurrency: env.uptime.workerConcurrency,
      },
    };
  } catch (error) {
    return {
      redis: {
        configured: true,
        ok: false,
        status: connection.status ?? 'error',
        error: error.message,
      },
      queue: {
        name: UPTIME_QUEUE_NAME,
        counts: null,
      },
      scheduler: {
        intervalSeconds: env.uptime.schedulerIntervalSeconds,
        scanLimit: env.uptime.schedulerScanLimit,
        workerConcurrency: env.uptime.workerConcurrency,
      },
    };
  } finally {
    await queue.close?.();
    await closeRedisConnection(connection);
  }
}
