import { describe, expect, it } from 'vitest';
import type { Account, ExchangeRate, Transaction, TransactionPage } from '../types/banking';
import { bankDateKey } from '../utils/dates';
import { db, DEMO_EMAIL, DEMO_PASSWORD } from './db';

const DAY_MS = 86_400_000;

async function signIn(): Promise<string> {
  const response = await fetch(new URL('/api/auth/login', window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const body = await response.json();
  return body.session.token;
}

function get(path: string, token?: string) {
  return fetch(new URL(path, window.location.origin), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

async function getPage(query = ''): Promise<TransactionPage> {
  const token = await signIn();
  return (await get(`/api/transactions${query}`, token)).json();
}

async function getTransactions(query = ''): Promise<Transaction[]> {
  return (await getPage(query)).transactions;
}

describe('banking API mock', () => {
  it.each(['/api/accounts', '/api/exchange-rate', '/api/transactions'])(
    '%s requires a session',
    async (path) => {
      const response = await get(path);
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.code).toBe('SESSION_EXPIRED');
    },
  );

  it('returns the three demo accounts', async () => {
    const token = await signIn();
    const body: { accounts: Account[] } = await (await get('/api/accounts', token)).json();

    expect(body.accounts.map(({ number, type, currency, balance }) => ({ number, type, currency, balance }))).toEqual([
      { number: '2004587214521', type: 'savings', currency: 'DOP', balance: 145230.5 },
      { number: '2004587219874', type: 'checking', currency: 'DOP', balance: 38940 },
      { number: '2004587213307', type: 'savings', currency: 'USD', balance: 2350.75 },
    ]);
  });

  it('returns the reference exchange rate', async () => {
    const token = await signIn();
    const body: ExchangeRate = await (await get('/api/exchange-rate', token)).json();

    expect(body).toEqual({ usdToDop: 60.83, buy: 60.2, sell: 61.4, date: '2026-10-23' });
  });

  it('returns transactions newest first', async () => {
    const transactions = await getTransactions('?pageSize=50');
    const times = transactions.map((transaction) => Date.parse(transaction.date));

    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('keeps transactions within the last 60 days', async () => {
    const now = Date.now();
    const transactions = await getTransactions('?pageSize=50');

    for (const transaction of transactions) {
      const time = Date.parse(transaction.date);
      expect(time).toBeLessThanOrEqual(now);
      expect(time).toBeGreaterThanOrEqual(now - 60 * DAY_MS);
    }
  });

  it('gives every transaction the currency of its account', async () => {
    const token = await signIn();
    const { accounts }: { accounts: Account[] } = await (await get('/api/accounts', token)).json();
    const currencies = new Map(accounts.map((account) => [account.id, account.currency]));
    const transactions = await getTransactions('?pageSize=50');

    for (const transaction of transactions) {
      expect(transaction.currency).toBe(currencies.get(transaction.accountId));
    }
  });

  it('links every transaction to an account with a positive amount', async () => {
    const token = await signIn();
    const { accounts }: { accounts: Account[] } = await (await get('/api/accounts', token)).json();
    const ids = new Set(accounts.map((account) => account.id));
    const transactions = await getTransactions('?pageSize=50');

    for (const transaction of transactions) {
      expect(ids.has(transaction.accountId)).toBe(true);
      expect(transaction.amount).toBeGreaterThan(0);
    }
  });

  it('returns the first page with totals by default', async () => {
    const page = await getPage();

    expect(page).toMatchObject({ page: 1, pageSize: 10, total: db.transactions.length });
    expect(page.totalPages).toBe(Math.ceil(db.transactions.length / 10));
    expect(page.transactions).toHaveLength(10);
  });

  it('respects the page size', async () => {
    expect(await getTransactions('?pageSize=5')).toHaveLength(5);
  });

  it('caps the page size at 50', async () => {
    const extra = Array.from({ length: 60 }, (_, index) => ({
      ...db.transactions[0],
      id: `extra-${index}`,
    }));
    db.transactions.push(...extra);

    expect(await getTransactions('?pageSize=100')).toHaveLength(50);
  });

  it.each(['abc', '0', '-3'])('uses defaults for an invalid page or size (%s)', async (value) => {
    const page = await getPage(`?page=${value}&pageSize=${value}`);
    expect(page).toMatchObject({ page: 1, pageSize: 10 });
  });

  it('ignores an invalid type or date', async () => {
    const page = await getPage('?type=foo&from=bad&to=2026-13-45');
    expect(page.total).toBe(db.transactions.length);
  });

  it('filters by account and type', async () => {
    const transactions = await getTransactions('?accountId=acc-usd-savings&type=credit&pageSize=50');

    expect(transactions.length).toBeGreaterThan(0);
    for (const transaction of transactions) {
      expect(transaction.accountId).toBe('acc-usd-savings');
      expect(transaction.type).toBe('credit');
    }
  });

  it('rejects a start date after the end date', async () => {
    const token = await signIn();
    const response = await get('/api/transactions?from=2026-10-20&to=2026-10-01', token);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'The start date must be before the end date.',
    });
  });

  it('returns an empty page for an unknown account', async () => {
    expect(await getPage('?accountId=unknown')).toMatchObject({
      transactions: [],
      total: 0,
      totalPages: 1,
    });
  });

  it('returns an empty list beyond the last page', async () => {
    expect(await getPage('?page=99')).toMatchObject({ transactions: [], page: 99 });
  });

  it('requires a session to export', async () => {
    expect((await get('/api/transactions/export')).status).toBe(401);
  });

  it('exports every matching transaction as CSV', async () => {
    const token = await signIn();
    const response = await get('/api/transactions/export?type=credit', token);
    const csv = await response.text();
    const credits = db.transactions.filter((transaction) => transaction.type === 'credit');

    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="altura-transactions-${bankDateKey(new Date().toISOString())}.csv"`,
    );
    expect(csv.split('\r\n')).toHaveLength(credits.length + 1);
    expect(csv.startsWith('Date,Description,Account,Type,Amount,Currency')).toBe(true);
  });
});
