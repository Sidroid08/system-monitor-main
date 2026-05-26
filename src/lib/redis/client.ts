import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redisClient: Redis | null = null;

if (typeof window === 'undefined') {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 200, 2000);
      },
    });

    redisClient.on('error', (err) => {
      // Log connection issues but do not crash Node process
      console.warn('Redis Connection Error:', err.message);
    });
  } catch (error) {
    console.warn('Redis client initialization failed:', error);
  }
}

export { redisClient };
