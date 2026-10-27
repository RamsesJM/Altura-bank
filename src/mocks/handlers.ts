import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, Session } from '../types/auth';
import {
  createToken,
  db,
  LOCKOUT_MS,
  MAX_FAILED_ATTEMPTS,
  saveDb,
  SESSION_TTL_MS,
  toPublicUser,
} from './db';

const INVALID_CREDENTIALS_MESSAGE = 'Incorrect email or password.';

async function simulateLatency() {
  if (import.meta.env.MODE === 'test') return;
  await delay(400 + Math.random() * 400);
}

function errorResponse(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status });
}

function sessionExpired() {
  return errorResponse(401, { code: 'SESSION_EXPIRED', message: 'Your session has expired.' });
}

function issueSession(token: string, userId: string): Session {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.sessions.set(token, { userId, expiresAt });
  saveDb();
  return { token, expiresAt: new Date(expiresAt).toISOString() };
}

function readToken(request: Request): string | null {
  const header = request.headers.get('Authorization');
  return header?.startsWith('Bearer ') ? header.slice(7) : null;
}

function findActiveSession(request: Request) {
  const token = readToken(request);
  if (!token) return null;

  const session = db.sessions.get(token);
  if (!session) return null;

  if (session.expiresAt <= Date.now()) {
    db.sessions.delete(token);
    saveDb();
    return null;
  }

  return { token, session };
}

function releaseExpiredLock() {
  if (db.lockedUntil !== null && db.lockedUntil <= Date.now()) {
    db.lockedUntil = null;
    db.failedAttempts = 0;
    saveDb();
  }
}

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    await simulateLatency();

    const body = (await request.json().catch(() => null)) as {
      email?: unknown;
      password?: unknown;
    } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!email || !password) {
      return errorResponse(400, {
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required.',
      });
    }

    releaseExpiredLock();

    if (db.lockedUntil !== null) {
      return errorResponse(423, {
        code: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked.',
        lockedUntil: new Date(db.lockedUntil).toISOString(),
      });
    }

    const user = db.users.find((candidate) => candidate.email === email);

    if (!user || user.password !== password) {
      db.failedAttempts += 1;

      if (db.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        db.lockedUntil = Date.now() + LOCKOUT_MS;
        saveDb();
        return errorResponse(423, {
          code: 'ACCOUNT_LOCKED',
          message: 'Account temporarily locked.',
          lockedUntil: new Date(db.lockedUntil).toISOString(),
        });
      }

      saveDb();
      return errorResponse(401, {
        code: 'INVALID_CREDENTIALS',
        message: INVALID_CREDENTIALS_MESSAGE,
        attemptsRemaining: MAX_FAILED_ATTEMPTS - db.failedAttempts,
      });
    }

    db.failedAttempts = 0;
    user.lastLoginAt = user.currentLoginAt;
    user.currentLoginAt = new Date().toISOString();

    return HttpResponse.json({
      user: toPublicUser(user),
      session: issueSession(createToken(), user.id),
    });
  }),

  http.get('/api/auth/me', async ({ request }) => {
    await simulateLatency();

    const active = findActiveSession(request);
    const user = active && db.users.find((candidate) => candidate.id === active.session.userId);
    if (!active || !user) return sessionExpired();

    return HttpResponse.json({
      user: toPublicUser(user),
      session: { token: active.token, expiresAt: new Date(active.session.expiresAt).toISOString() },
    });
  }),

  http.post('/api/auth/refresh', async ({ request }) => {
    await simulateLatency();

    const active = findActiveSession(request);
    if (!active) return sessionExpired();

    return HttpResponse.json({ session: issueSession(active.token, active.session.userId) });
  }),

  http.post('/api/auth/logout', async ({ request }) => {
    await simulateLatency();

    const token = readToken(request);
    if (token) {
      db.sessions.delete(token);
      saveDb();
    }

    return new HttpResponse(null, { status: 204 });
  }),
];
