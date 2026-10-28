import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../mocks/db';
import { server } from '../mocks/server';
import type { AuthResponse } from '../types/auth';
import { ApiError, apiRequest, setAuthToken, setUnauthorizedHandler } from './apiClient';
import { login, logout } from './authService';

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('Expected the request to fail');
}

describe('apiClient', () => {
  afterEach(() => {
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });

  it('maps 401 to ApiError with code and attemptsRemaining', async () => {
    const error = await captureError(login(DEMO_EMAIL, 'wrong'));

    expect(error.status).toBe(401);
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.attemptsRemaining).toBe(2);
  });

  it('maps 423 to ACCOUNT_LOCKED with lockedUntil', async () => {
    await captureError(login(DEMO_EMAIL, 'wrong'));
    await captureError(login(DEMO_EMAIL, 'wrong'));
    const error = await captureError(login(DEMO_EMAIL, 'wrong'));

    expect(error.status).toBe(423);
    expect(error.code).toBe('ACCOUNT_LOCKED');
    expect(error.lockedUntil).toBeDefined();
  });

  it('maps 500 to UNKNOWN_ERROR with a generic message', async () => {
    server.use(
      http.get('/api/auth/me', () => HttpResponse.json({ stack: 'internal' }, { status: 500 })),
    );

    const error = await captureError(apiRequest('/api/auth/me'));

    expect(error.status).toBe(500);
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.message).toBe('Something went wrong. Please try again.');
  });

  it('maps network failure to NETWORK_ERROR with status 0', async () => {
    server.use(http.get('/api/auth/me', () => HttpResponse.error()));

    const error = await captureError(apiRequest('/api/auth/me'));

    expect(error.status).toBe(0);
    expect(error.code).toBe('NETWORK_ERROR');
  });

  it('sends the Authorization header after setAuthToken', async () => {
    const { session } = await login(DEMO_EMAIL, DEMO_PASSWORD);
    setAuthToken(session.token);

    const response = await apiRequest<AuthResponse>('/api/auth/me');

    expect(response.user.email).toBe(DEMO_EMAIL);
  });

  it('calls the unauthorized handler on 401 from /api/auth/me', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await captureError(apiRequest('/api/auth/me'));

    expect(handler).toHaveBeenCalledOnce();
  });

  it('does not call the unauthorized handler on 401 from /api/auth/login', async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);

    await captureError(login(DEMO_EMAIL, 'wrong'));

    expect(handler).not.toHaveBeenCalled();
  });

  it('returns undefined for 204 responses', async () => {
    const { session } = await login(DEMO_EMAIL, DEMO_PASSWORD);
    setAuthToken(session.token);

    await expect(logout()).resolves.toBeUndefined();
  });

  it('sends extra headers', async () => {
    let received: string | null = null;
    server.use(
      http.post('/api/probe', ({ request }) => {
        received = request.headers.get('Idempotency-Key');
        return HttpResponse.json({});
      }),
    );

    await apiRequest('/api/probe', { method: 'POST', headers: { 'Idempotency-Key': 'key-1' } });

    expect(received).toBe('key-1');
  });

  it('keeps the field and the daily limit left on transfer errors', async () => {
    server.use(
      http.post('/api/probe', () =>
        HttpResponse.json(
          {
            code: 'DAILY_LIMIT_EXCEEDED',
            message: 'Over the limit.',
            field: 'amount',
            dailyRemaining: 50000,
          },
          { status: 422 },
        ),
      ),
    );

    const error = await captureError(apiRequest('/api/probe', { method: 'POST', body: {} }));

    expect(error).toMatchObject({
      status: 422,
      code: 'DAILY_LIMIT_EXCEEDED',
      message: 'Over the limit.',
      field: 'amount',
      dailyRemaining: 50000,
    });
  });
});
