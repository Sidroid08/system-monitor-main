import { apiClient } from './client';
import type { AuthResponse, LoginPayload, RegisterPayload, User } from '@/types';

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const res = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/login', payload);
  return res.data.data!;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const res = await apiClient.post<{ success: boolean; data: AuthResponse }>('/auth/register', payload);
  return res.data.data!;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<{ success: boolean; data: { user: User } }>('/auth/me');
  return res.data.data!.user;
}
