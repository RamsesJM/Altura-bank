import type { AuthResponse, Session } from '../types/auth';
import { apiRequest } from './apiClient';

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export function getCurrentUser(): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/api/auth/me');
}

export function refreshSession(): Promise<{ session: Session }> {
  return apiRequest<{ session: Session }>('/api/auth/refresh', { method: 'POST' });
}

export function logout(): Promise<void> {
  return apiRequest<void>('/api/auth/logout', { method: 'POST' });
}
