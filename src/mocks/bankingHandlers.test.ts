import { describe, expect, it } from 'vitest';
import type { Account, ExchangeRate, Transaction } from '../types/banking';
import { DEMO_EMAIL, DEMO_PASSWORD } from './db';

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

async function getTransactions(query = ''): Promise<Transaction[]> {
  const token = await signIn();
  const body = await (await get(`/api/transactions${query}`, token)).json();
  return body.transactions;
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

    expect(body).toEqual({ usdToDop: 60.83, date: '2026-10-23' });
  });

  it('returns transactions newest first', async () => {
    const transactions = await getTransactions('?limit=50');
    const times = transactions.map((transaction) => Date.parse(transaction.date));

    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('respects the limit', async () => {
    expect(await getTransactions('?limit=5')).toHaveLength(5);
  });

  it('uses 20 as the default limit', async () => {
    expect(await getTransactions()).toHaveLength(20);
  });

  it('caps the limit at 50', async () => {
    const all = await getTransactions('?limit=100');
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(all.length).toBeLessThanOrEqual(50);
  });

  it.each(['abc', '0', '-3'])('falls back to 20 for an invalid limit (%s)', async (limit) => {
    expect(await getTransactions(`?limit=${limit}`)).toHaveLength(20);
  });

  it('keeps transactions within the last 60 days', async () => {
    const now = Date.now();
    const transactions = await getTransactions('?limit=50');

    for (const transaction of transactions) {
      const time = Date.parse(transaction.date);
      expect(time).toBeLessThanOrEqual(now);
      expect(time).toBeGreaterThanOrEqual(now - 60 * DAY_MS);
    }
  });

  it('links every transaction to an account with a positive amount', async () => {
    const token = await signIn();
    const { accounts }: { accounts: Account[] } = await (await get('/api/accounts', token)).json();
    const ids = new Set(accounts.map((account) => account.id));
    const transactions = await getTransactions('?limit=50');

    for (const transaction of transactions) {
      expect(ids.has(transaction.accountId)).toBe(true);
      expect(transaction.amount).toBeGreaterThan(0);
    }
  });
});
