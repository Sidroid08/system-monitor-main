import { redisCache } from './cache';
import type { MetricsData } from '@/types';

interface Snapshot {
  instanceId: string;
  timestamp: number;
  data: MetricsData;
}

const SNAPSHOT_KEY_PREFIX = 'metrics_snapshot:';
const SNAPSHOT_TTL = 3600; // 1 hour

export async function saveMetricsSnapshot(instanceId: string, data: MetricsData): Promise<void> {
  const snapshot: Snapshot = {
    instanceId,
    timestamp: Date.now(),
    data,
  };
  
  const key = `${SNAPSHOT_KEY_PREFIX}${instanceId}`;
  await redisCache.set(key, snapshot, SNAPSHOT_TTL);
}

export async function getMetricsSnapshot(instanceId: string): Promise<Snapshot | null> {
  const key = `${SNAPSHOT_KEY_PREFIX}${instanceId}`;
  return await redisCache.get<Snapshot>(key);
}

export async function getAllSnapshots(): Promise<Snapshot[]> {
  const snapshots: Snapshot[] = [];
  const keys = await redisCache.keys();
  
  for (const key of keys) {
    if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
      const snapshot = await redisCache.get<Snapshot>(key);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
  }
  
  return snapshots;
}

export async function clearSnapshots(): Promise<void> {
  const keys = await redisCache.keys();
  for (const key of keys) {
    if (key.startsWith(SNAPSHOT_KEY_PREFIX)) {
      await redisCache.delete(key);
    }
  }
}
