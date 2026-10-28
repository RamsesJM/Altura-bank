import { delay, http, HttpResponse } from 'msw';
import type { ApiErrorBody, Session } from '../types/auth';
import type {
  Account,
  Transaction,
  TransactionFilters,
  TransferConfirmRequest,
  TransferQuoteRequest,
  TransferReceipt,
} from '../types/banking';
import { bankDateKey } from '../utils/dates';
import { maskAccountNumber } from '../utils/format';
import { fromCents, toCents, toDopCents } from '../utils/money';
import { EXCHANGE_RATE } from './bankingData';
import { filterTransactions, paginate, toCsv } from './transactionQuery';
import { DEMO_OTP, MAX_OTP_ATTEMPTS, maskHolderName, quoteTransfer } from './transferRules';
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

const ACCOUNT_LABELS: Record<Account['type'], string> = {
  savings: 'Savings',
  checking: 'Checking',
};
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function accountLabel(account: Account): string {
  return `${ACCOUNT_LABELS[account.type]} ${account.currency} ${maskAccountNumber(account.number)}`;
}

function createReference(now: number): string {
  const day = bankDateKey(new Date(now).toISOString()).replaceAll('-', '');
  const random = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(random, (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]);
  return `TRF-${day}-${suffix.join('')}`;
}

function transferState() {
  return {
    accounts: db.accounts,
    directory: db.directory,
    transfers: db.transfers,
    rate: EXCHANGE_RATE,
  };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
}

function readQuoteRequest(body: Record<string, unknown>): TransferQuoteRequest {
  const to = (typeof body.to === 'object' && body.to !== null ? body.to : {}) as Record<
    string,
    unknown
  >;
  return {
    fromAccountId: String(body.fromAccountId ?? ''),
    to:
      to.type === 'third-party'
        ? { type: 'third-party', accountNumber: String(to.accountNumber ?? '') }
        : { type: 'own', accountId: String(to.accountId ?? '') },
    amount: String(body.amount ?? ''),
    description: typeof body.description === 'string' ? body.description : undefined,
  };
}

const QUOTE_EXPIRED: ApiErrorBody = {
  code: 'QUOTE_EXPIRED',
  message: 'This quote has expired. Review the transfer again.',
};

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

  http.get('/api/accounts/lookup', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    const number = new URL(request.url).searchParams.get('number')?.trim() ?? '';
    if (db.accounts.some((account) => account.number === number)) {
      return errorResponse(422, {
        code: 'OWN_ACCOUNT',
        message: 'This is one of your accounts. Choose it under My accounts.',
      });
    }

    const entry = db.directory.find((account) => account.accountNumber === number);
    if (!entry) {
      return errorResponse(404, {
        code: 'ACCOUNT_NOT_FOUND',
        message: "We couldn't find that account.",
      });
    }

    return HttpResponse.json({
      accountNumber: entry.accountNumber,
      holderName: maskHolderName(entry.holderName),
      currency: entry.currency,
    });
  }),

  http.get('/api/beneficiaries', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    return HttpResponse.json({ beneficiaries: db.beneficiaries });
  }),

  http.post('/api/transfers/quote', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    const quoteRequest = readQuoteRequest(await readJson(request));
    const result = quoteTransfer(transferState(), quoteRequest, Date.now());
    if (!result.ok) return errorResponse(result.status, result.error);

    db.quotes[result.quote.quoteId] = {
      request: quoteRequest,
      quote: result.quote,
      otpAttempts: 0,
      status: 'open',
    };
    saveDb();
    return HttpResponse.json(result.quote);
  }),

  http.post('/api/transfers', async ({ request }) => {
    await simulateLatency();
    if (!findActiveSession(request)) return sessionExpired();

    const key = request.headers.get('Idempotency-Key')?.trim();
    if (!key) {
      return errorResponse(400, { code: 'VALIDATION_ERROR', message: 'Missing idempotency key.' });
    }

    const previous = db.transfers.find((transfer) => transfer.idempotencyKey === key);
    if (previous) return HttpResponse.json(previous.receipt);

    const body = (await readJson(request)) as Partial<TransferConfirmRequest>;
    const stored = db.quotes[String(body.quoteId ?? '')];
    const now = Date.now();

    if (stored?.status === 'used') {
      return errorResponse(409, {
        code: 'QUOTE_USED',
        message: 'This transfer was already sent. Check your transactions.',
      });
    }
    if (!stored || stored.status === 'locked' || Date.parse(stored.quote.expiresAt) <= now) {
      return errorResponse(409, QUOTE_EXPIRED);
    }

    const { quote } = stored;

    if (quote.requiresOtp && body.otp !== DEMO_OTP) {
      stored.otpAttempts += 1;
      if (stored.otpAttempts >= MAX_OTP_ATTEMPTS) {
        stored.status = 'locked';
        saveDb();
        return errorResponse(423, {
          code: 'OTP_LOCKED',
          message: 'Too many attempts. Start a new transfer.',
        });
      }
      saveDb();
      return errorResponse(422, {
        code: 'INVALID_OTP',
        message: 'Incorrect code.',
        attemptsRemaining: MAX_OTP_ATTEMPTS - stored.otpAttempts,
      });
    }

    const recheck = quoteTransfer(transferState(), stored.request, now);
    if (!recheck.ok) return errorResponse(recheck.status, recheck.error);

    const source = db.accounts.find((account) => account.id === quote.from.accountId);
    if (!source) return errorResponse(409, QUOTE_EXPIRED);
    const target = quote.to.own
      ? db.accounts.find((account) => account.number === quote.to.accountNumber)
      : undefined;

    const reference = createReference(now);
    const createdAt = new Date(now).toISOString();

    source.balance = fromCents(toCents(source.balance) - toCents(quote.debit));
    const outgoing: Transaction = {
      id: `trf-${reference}-out`,
      accountId: source.id,
      date: createdAt,
      description:
        quote.description ?? `Transfer to ${target ? accountLabel(target) : quote.to.holderName}`,
      amount: quote.debit,
      currency: source.currency,
      type: 'debit',
    };
    db.transactions.push(outgoing);

    if (target) {
      target.balance = fromCents(toCents(target.balance) + toCents(quote.credit));
      db.transactions.push({
        id: `trf-${reference}-in`,
        accountId: target.id,
        date: createdAt,
        description: quote.description ?? `Transfer from ${accountLabel(source)}`,
        amount: quote.credit,
        currency: target.currency,
        type: 'credit',
      });
    }

    const alreadySaved = db.beneficiaries.some(
      (beneficiary) => beneficiary.accountNumber === quote.to.accountNumber,
    );
    if (body.saveBeneficiary && !quote.to.own && !alreadySaved) {
      db.beneficiaries.push({
        id: `ben-${quote.to.accountNumber}`,
        alias: quote.to.holderName,
        accountNumber: quote.to.accountNumber,
        holderName: quote.to.holderName,
        currency: quote.to.currency,
      });
    }

    const receipt: TransferReceipt = {
      from: quote.from,
      to: quote.to,
      debit: quote.debit,
      credit: quote.credit,
      rate: quote.rate,
      description: quote.description,
      dailyRemaining: quote.dailyRemaining,
      reference,
      createdAt,
    };

    stored.status = 'used';
    db.transfers.push({
      idempotencyKey: key,
      quoteId: quote.quoteId,
      receipt,
      thirdPartyDop: quote.to.own
        ? null
        : fromCents(toDopCents(toCents(quote.debit), quote.from.currency, EXCHANGE_RATE)),
    });
    saveDb();

    return HttpResponse.json(receipt);
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
