import { QueryClient, type DefaultOptions } from '@tanstack/react-query';
import { ApiError } from './apiClient';

const MAX_RETRIES = 1;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status === 401) return false;
  return failureCount < MAX_RETRIES;
}

export function createQueryClient(overrides: DefaultOptions['queries'] = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        ...overrides,
      },
    },
  });
}
