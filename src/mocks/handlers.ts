import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, Session } from '../types/auth';
import type { TransactionFilters } from '../types/banking';
import { bankDateKey } from '../utils/dates';
import { EXCHANGE_RATE } from './bankingData';
import { filterTransactions, paginate, toCsv } from './transactionQuery';
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
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const INVALID_RANGE: ApiErrorBody = {
  code: 'VALIDATION_ERROR',
  message: 'The start date must be before the end date.',
};

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

function readPositiveInteger(value: string | null, fallback: number): number {
  const number = Number(value);
  return value !== null && Number.isInteger(number) && number > 0 ? number : fallback;
}

function readDate(value: string | null): string | undefined {
  if (!value || !DATE_PATTERN.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

function readFilters(request: Request): TransactionFilters {
  const params = new URL(request.url).searchParams;
  const type = params.get('type');

  return {
    accountId: params.get('accountId') || undefined,
    type: type === 'credit' || type === 'debit' ? type : undefined,
    from: readDate(params.get('from')),
    to: readDate(params.get('to')),
    q: params.get('q')?.trim() || undefined,
  };
}

function hasInvalidRange({ from, to }: TransactionFilters): boolean {
  return Boolean(from && to && from > to);
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

  http.get('/api/accounts', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    return HttpResponse.json({ accounts: db.accounts });
  }),

  http.get('/api/exchange-rate', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    return HttpResponse.json(EXCHANGE_RATE);
  }),

  http.get('/api/transactions', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    const filters = readFilters(request);
    if (hasInvalidRange(filters)) return errorResponse(400, INVALID_RANGE);

    const params = new URL(request.url).searchParams;
    const page = readPositiveInteger(params.get('page'), 1);
    const pageSize = Math.min(readPositiveInteger(params.get('pageSize'), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
    const { items, total, totalPages } = paginate(
      filterTransactions(db.transactions, filters),
      page,
      pageSize,
    );

    return HttpResponse.json({ transactions: items, page, pageSize, total, totalPages });
  }),

  http.get('/api/transactions/export', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    const filters = readFilters(request);
    if (hasInvalidRange(filters)) return errorResponse(400, INVALID_RANGE);

    const csv = toCsv(filterTransactions(db.transactions, filters), db.accounts);
    const fileName = `altura-transactions-${bankDateKey(new Date().toISOString())}.csv`;

    return new HttpResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });
  }),
];
