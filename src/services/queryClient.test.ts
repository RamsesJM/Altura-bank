import { describe, expect, it } from 'vitest';
import { ApiError } from './apiClient';
import { createQueryClient, shouldRetry } from './queryClient';

const serverError = new ApiError(500, { code: 'UNKNOWN_ERROR', message: 'Server error' });
const networkError = new ApiError(0, { code: 'NETWORK_ERROR', message: 'Offline' });
const expiredError = new ApiError(401, { code: 'SESSION_EXPIRED', message: 'Expired' });

describe('shouldRetry', () => {
  it('retries a server error once', () => {
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, serverError)).toBe(false);
  });

  it('retries a network error once', () => {
    expect(shouldRetry(0, networkError)).toBe(true);
  });

  it('never retries an expired session', () => {
    expect(shouldRetry(0, expiredError)).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('applies the banking query defaults', () => {
    const queries = createQueryClient().getDefaultOptions().queries;

    expect(queries?.staleTime).toBe(30_000);
    expect(queries?.refetchOnWindowFocus).toBe(true);
    expect(queries?.retry).toBe(shouldRetry);
  });
});
