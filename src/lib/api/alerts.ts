import { apiClient } from './client';
import type { Alert } from '@/types';

export async function getAlerts(params?: { organizationId?: string; status?: Alert['status'] | 'ALL' }): Promise<Alert[]> {
  const res = await apiClient.get<{ success: boolean; data: Alert[] }>('/alerts', { params });
  return res.data.data ?? [];
}

export async function acknowledgeAlert(id: string): Promise<Alert> {
  const res = await apiClient.patch<{ success: boolean; data: Alert }>(`/alerts/${id}/acknowledge`);
  return res.data.data!;
}

export async function resolveAlert(id: string): Promise<Alert> {
  const res = await apiClient.patch<{ success: boolean; data: Alert }>(`/alerts/${id}/resolve`);
  return res.data.data!;
}

export async function getDashboardStats(organizationId?: string): Promise<{
  totalInstances: number;
  runningInstances: number;
  stoppedInstances: number;
  openAlerts: number;
  criticalAlerts: number;
  awsAccounts: number;
}> {
  const params = organizationId ? { organizationId } : {};
  const res = await apiClient.get('/alerts/stats/dashboard', { params });
  return res.data.data;
}
