import { apiClient } from './client';
import type { Organization } from '@/types';

export async function getOrganizations(): Promise<Organization[]> {
  const res = await apiClient.get<{ success: boolean; data: Organization[] }>('/org');
  return res.data.data ?? [];
}

export async function getOrganizationById(id: string): Promise<Organization> {
  const res = await apiClient.get<{ success: boolean; data: Organization }>(`/org/${id}`);
  return res.data.data!;
}

export async function createOrganization(payload: { name: string; slug: string }): Promise<Organization> {
  const res = await apiClient.post<{ success: boolean; data: Organization }>('/org', payload);
  return res.data.data!;
}
