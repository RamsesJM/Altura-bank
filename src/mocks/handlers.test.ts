import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiErrorBody, AuthResponse, Session } from '../types/auth';
import { DEMO_EMAIL, DEMO_PASSWORD, LOCKOUT_MS, restoreDb, SESSION_TTL_MS } from './db';

function request(path: string, init: RequestInit = {}) {
  return fetch(new URL(path, window.location.origin), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
}

function login(email: string, password: string) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

function authorized(path: string, token: string, method = 'GET') {
  return request(path, { method, headers: { Authorization: `Bearer ${token}` } });
}

async function signIn(): Promise<AuthResponse> {
  const response = await login(DEMO_EMAIL, DEMO_PASSWORD);
  return response.json();
}

describe('auth API mock', () => {
  afterEach(() => vi.useRealTimers());

  it('login with demo credentials returns user and session', async () => {
    const response = await login(DEMO_EMAIL, DEMO_PASSWORD);
    const body: AuthResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.email).toBe('demo@alturabank.com');
    expect(body.session.token).not.toBe('');
    const ttl = new Date(body.session.expiresAt).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(SESSION_TTL_MS - 2_000);
    expect(ttl).toBeLessThanOrEqual(SESSION_TTL_MS);
  });

  it('login normalizes email casing and whitespace', async () => {
    const response = await login(' DEMO@AlturaBank.com ', DEMO_PASSWORD);
    expect(response.status).toBe(200);
  });

  it('wrong password returns 401 with attempts remaining', async () => {
    const first = await login(DEMO_EMAIL, 'wrong');
    const firstBody: ApiErrorBody = await first.json();
    const second = await login(DEMO_EMAIL, 'wrong');
    const secondBody: ApiErrorBody = await second.json();

    expect(first.status).toBe(401);
    expect(firstBody.code).toBe('INVALID_CREDENTIALS');
    expect(firstBody.attemptsRemaining).toBe(2);
    expect(secondBody.attemptsRemaining).toBe(1);
  });

  it('third failure locks the account', async () => {
    await login(DEMO_EMAIL, 'wrong');
    await login(DEMO_EMAIL, 'wrong');
    const third = await login(DEMO_EMAIL, 'wrong');
    const body: ApiErrorBody = await third.json();

    expect(third.status).toBe(423);
    expect(body.code).toBe('ACCOUNT_LOCKED');
    const lockMs = new Date(body.lockedUntil!).getTime() - Date.now();
    expect(lockMs).toBeGreaterThan(LOCKOUT_MS - 2_000);

    const correctDuringLock = await login(DEMO_EMAIL, DEMO_PASSWORD);
    expect(correctDuringLock.status).toBe(423);
  });

  it('lockout ends after 60 seconds and attempts reset', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (let i = 0; i < 3; i++) await login(DEMO_EMAIL, 'wrong');

    vi.advanceTimersByTime(LOCKOUT_MS + 1);
    const afterLock = await login(DEMO_EMAIL, 'wrong');
    const body: ApiErrorBody = await afterLock.json();

    expect(afterLock.status).toBe(401);
    expect(body.attemptsRemaining).toBe(2);
  });

  it('unknown email returns the same 401 message as wrong password', async () => {
    const unknown: ApiErrorBody = await (await login('nobody@example.com', 'x')).json();
    const wrong: ApiErrorBody = await (await login(DEMO_EMAIL, 'x')).json();

    expect(unknown.code).toBe('INVALID_CREDENTIALS');
    expect(unknown.message).toBe(wrong.message);
  });

  it('missing fields return 400 VALIDATION_ERROR', async () => {
    const response = await login('', '');
    const body: ApiErrorBody = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('me without token returns 401 SESSION_EXPIRED', async () => {
    const response = await request('/api/auth/me');
    const body: ApiErrorBody = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('SESSION_EXPIRED');
  });

  it('me with valid token returns the user', async () => {
    const { session } = await signIn();
    const response = await authorized('/api/auth/me', session.token);
    const body: AuthResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.fullName).toBe('Ramses Demo');
  });

  it('first login has no previous login date and the next one does', async () => {
    const first = await signIn();
    const second = await signIn();

    expect(first.user.lastLoginAt).toBeNull();
    expect(second.user.lastLoginAt).not.toBeNull();
  });

  it('refresh extends expiresAt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { session } = await signIn();

    vi.advanceTimersByTime(60_000);
    const response = await authorized('/api/auth/refresh', session.token, 'POST');
    const body: { session: Session } = await response.json();

    expect(response.status).toBe(200);
    expect(new Date(body.session.expiresAt).getTime()).toBeGreaterThan(
      new Date(session.expiresAt).getTime(),
    );
  });

  it('logout invalidates the token', async () => {
    const { session } = await signIn();
    const logout = await authorized('/api/auth/logout', session.token, 'POST');
    const me = await authorized('/api/auth/me', session.token);

    expect(logout.status).toBe(204);
    expect(me.status).toBe(401);
  });

  it('keeps sessions and last login after a page reload', async () => {
    const { session } = await signIn();

    restoreDb();
    const response = await authorized('/api/auth/me', session.token);
    const body: AuthResponse = await response.json();

    expect(response.status).toBe(200);
    expect(body.user.lastLoginAt).toBeNull();
    expect((await signIn()).user.lastLoginAt).not.toBeNull();
  });

  it('keeps the lockout after a page reload', async () => {
    for (let i = 0; i < 3; i++) await login(DEMO_EMAIL, 'wrong');

    restoreDb();
    const response = await login(DEMO_EMAIL, DEMO_PASSWORD);

    expect(response.status).toBe(423);
  });

  it('session expires after 5 minutes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { session } = await signIn();

    vi.advanceTimersByTime(SESSION_TTL_MS + 1);
    const me = await authorized('/api/auth/me', session.token);

    expect(me.status).toBe(401);
  });
});
