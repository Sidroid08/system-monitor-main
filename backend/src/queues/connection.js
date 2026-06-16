import IORedis from 'ioredis';
import { env } from '../config/env.js';

export function requireRedisUrl() {
  if (!env.redis.url) {
    throw new Error('REDIS_URL is required for uptime worker and scheduler processes');
  }
  return env.redis.url;
}

export function createRedisConnection(options = {}) {
  return new IORedis(requireRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    ...options,
  });
}

export async function closeRedisConnection(connection) {
  if (!connection) return;
  if (typeof connection.quit === 'function') {
    try {
      await connection.quit();
      return;
    } catch {
      // Fall through to disconnect when graceful quit is not available.
    }
  }
  connection.disconnect?.();
}

export async function checkRedisConnection({ connectionFactory = createRedisConnection } = {}) {
  if (!env.redis.url) {
    return {
      configured: false,
      ok: false,
      status: 'not_configured',
      error: 'REDIS_URL is not set',
    };
  }

  const connection = connectionFactory({ lazyConnect: true });
  try {
    const pong = await connection.ping();
    return {
      configured: true,
      ok: pong === 'PONG',
      status: connection.status,
      error: null,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      status: connection.status ?? 'error',
      error: error.message,
    };
  } finally {
    await closeRedisConnection(connection);
  }
}
