import { redisClient } from './client';

interface CacheEntry<T> {
  value: T;
  expiry?: number;
}

class RedisCache {
  private localCache = new Map<string, CacheEntry<any>>();

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const valStr = JSON.stringify(value);
        if (ttlSeconds) {
          await redisClient.set(key, valStr, 'EX', ttlSeconds);
        } else {
          await redisClient.set(key, valStr);
        }
        return;
      } catch (error) {
        console.warn('Failed to set in Redis, falling back to local memory:', error);
      }
    }

    // Fallback
    const expiry = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.localCache.set(key, { value, expiry });
  }

  async get<T>(key: string): Promise<T | null> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const valStr = await redisClient.get(key);
        if (valStr) {
          return JSON.parse(valStr) as T;
        }
        return null;
      } catch (error) {
        console.warn('Failed to get from Redis, falling back to local memory:', error);
      }
    }

    // Fallback
    const entry = this.localCache.get(key);
    if (!entry) return null;

    if (entry.expiry && Date.now() > entry.expiry) {
      this.localCache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  async delete(key: string): Promise<boolean> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const res = await redisClient.del(key);
        return res > 0;
      } catch (error) {
        console.warn('Failed to delete from Redis:', error);
      }
    }
    return this.localCache.delete(key);
  }

  async clear(): Promise<void> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        await redisClient.flushdb();
        return;
      } catch (error) {
        console.warn('Failed to flush Redis:', error);
      }
    }
    this.localCache.clear();
  }

  async has(key: string): Promise<boolean> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const res = await redisClient.exists(key);
        return res > 0;
      } catch (error) {
        console.warn('Failed to check exists in Redis:', error);
      }
    }
    const entry = this.localCache.get(key);
    if (!entry) return false;
    if (entry.expiry && Date.now() > entry.expiry) {
      this.localCache.delete(key);
      return false;
    }
    return true;
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    if (redisClient && redisClient.status === 'ready') {
      try {
        return await redisClient.keys(pattern);
      } catch (error) {
        console.warn('Failed to fetch keys from Redis:', error);
      }
    }
    return Array.from(this.localCache.keys());
  }

  async getStats() {
    if (redisClient && redisClient.status === 'ready') {
      try {
        const info = await redisClient.info();
        return {
          type: 'redis',
          status: redisClient.status,
          info,
        };
      } catch (error) {
        // Fallback info
      }
    }
    return {
      type: 'memory',
      size: this.localCache.size,
      keys: Array.from(this.localCache.keys()),
    };
  }

  cleanup(): number {
    let cleaned = 0;
    for (const [key, entry] of this.localCache.entries()) {
      if (entry.expiry && Date.now() > entry.expiry) {
        this.localCache.delete(key);
        cleaned++;
      }
    }
    return cleaned;
  }
}

export const redisCache = new RedisCache();
