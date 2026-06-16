import IORedis from 'ioredis';
import { env } from '../config/env.js';

const memoryBuckets = new Map();
let redisClient;

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function safeLimitName(name) {
  return String(name ?? 'default').replace(/[^a-zA-Z0-9:_-]/g, '_');
}

export function authRateLimitKey(req) {
  return `ip:${clientIp(req)}`;
}

export function apiKeyRateLimitKey(req) {
  if (req.apiKey?.id && req.apiKey?.organizationId) {
    return `api-key:${req.apiKey.organizationId}:${req.apiKey.id}`;
  }
  return `ip:${clientIp(req)}`;
}

export function userRateLimitKey(req) {
  if (req.user?.id && req.user?.organizationId) {
    return `user:${req.user.organizationId}:${req.user.id}`;
  }
  return `ip:${clientIp(req)}`;
}

export function resetRateLimitStoresForTests() {
  if (env.nodeEnv !== 'test') return;
  memoryBuckets.clear();
}

async function memoryIncrement(key, windowSeconds) {
  const now = nowSeconds();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowSeconds;
    memoryBuckets.set(key, { count: 1, resetAt });
    return { count: 1, resetAt };
  }

  existing.count += 1;
  return existing;
}

function getRedisClient() {
  if (redisClient) return redisClient;
  if (!env.redis.url) return null;
  redisClient = new IORedis(env.redis.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 1000,
    commandTimeout: 1000,
  });
  redisClient.on('error', () => {});
  return redisClient;
}

async function redisIncrement(key, windowSeconds) {
  const client = getRedisClient();
  if (!client) return null;

  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, windowSeconds);
  }
  const ttl = await client.ttl(key);
  return { count, resetAt: nowSeconds() + Math.max(ttl, 0) };
}

async function incrementLimit(key, windowSeconds) {
  if (env.rateLimit.store === 'redis') {
    try {
      const redisResult = await redisIncrement(key, windowSeconds);
      if (redisResult) return redisResult;
    } catch {
      // Fall back to memory when Redis is unavailable; availability must not
      // turn a protected API into a 500.
    }
  }
  return memoryIncrement(key, windowSeconds);
}

export function createRateLimiter({
  name,
  windowSeconds,
  max,
  keyGenerator = authRateLimitKey,
  enabled = env.rateLimit.enabled,
} = {}) {
  const safeName = safeLimitName(name);
  const safeWindowSeconds = Math.max(Number(windowSeconds ?? 60), 1);
  const safeMax = Math.max(Number(max ?? 60), 1);

  return async function rateLimitMiddleware(req, res, next) {
    if (!enabled) return next();

    const key = `rate-limit:${safeName}:${keyGenerator(req)}`;
    const result = await incrementLimit(key, safeWindowSeconds);
    const remaining = Math.max(safeMax - result.count, 0);
    const retryAfterSeconds = Math.max(result.resetAt - nowSeconds(), 1);

    res.setHeader('X-RateLimit-Limit', String(safeMax));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(result.resetAt));

    if (result.count > safeMax) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: 'Too many requests',
        retryAfterSeconds,
      });
    }

    return next();
  };
}

export const authRateLimiter = createRateLimiter({
  name: 'auth',
  windowSeconds: env.rateLimit.auth.windowSeconds,
  max: env.rateLimit.auth.max,
  keyGenerator: authRateLimitKey,
});

export const ingestionRateLimiter = createRateLimiter({
  name: 'ingest',
  windowSeconds: env.rateLimit.ingest.windowSeconds,
  max: env.rateLimit.ingest.max,
  keyGenerator: apiKeyRateLimitKey,
});

export const queryRateLimiter = createRateLimiter({
  name: 'query',
  windowSeconds: env.rateLimit.query.windowSeconds,
  max: env.rateLimit.query.max,
  keyGenerator: userRateLimitKey,
});
