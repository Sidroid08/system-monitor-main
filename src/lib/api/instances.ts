import { apiClient } from './client';
import type { MonitoredInstance } from '@/types';

export async function getInstances(organizationId?: string): Promise<MonitoredInstance[]> {
  const params = organizationId ? { organizationId } : {};
  const res = await apiClient.get<{ success: boolean; data: MonitoredInstance[] }>('/instances', { params });
  return res.data.data ?? [];
}
