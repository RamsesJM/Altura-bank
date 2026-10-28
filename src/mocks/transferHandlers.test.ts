import { describe, expect, it } from 'vitest';
import type { ApiErrorBody } from '../types/auth';
import type {
  AccountLookup,
  Beneficiary,
  ExchangeRate,
  TransferQuote,
  TransferQuoteRequest,
  TransferReceipt,
} from '../types/banking';
import { db, DEMO_EMAIL, DEMO_PASSWORD, restoreDb } from './db';

const MARIA = '3001458820147';
const PEDRO = '3001458824410';

async function signIn(): Promise<string> {
  const response = await fetch(new URL('/api/auth/login', window.location.origin), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  return (await response.json()).session.token;
}

function request(path: string, token?: string, init: RequestInit = {}) {
  return fetch(new URL(path, window.location.origin), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
}

async function quote(token: string, body: TransferQuoteRequest): Promise<TransferQuote> {
  const response = await request('/api/transfers/quote', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json();
}

function confirm(
  token: string,
  body: { quoteId: string; otp?: string; saveBeneficiary?: boolean },
  key = crypto.randomUUID(),
) {
  return request('/api/transfers', token, {
    method: 'POST',
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(body),
  });
}

const own = (amount: string): TransferQuoteRequest => ({
  fromAccountId: 'acc-dop-savings',
  to: { type: 'own', accountId: 'acc-dop-checking' },
  amount,
});

const toMaria = (amount: string): TransferQuoteRequest => ({
  fromAccountId: 'acc-dop-savings',
  to: { type: 'third-party', accountNumber: MARIA },
  amount,
});

const balance = (id: string) => db.accounts.find((account) => account.id === id)?.balance;

describe('transfers API mock', () => {
  it.each([
    ['GET', '/api/beneficiaries'],
    ['GET', `/api/accounts/lookup?number=${MARIA}`],
    ['POST', '/api/transfers/quote'],
    ['POST', '/api/transfers'],
    ['GET', '/api/transfers/limits'],
  ])('%s %s requires a session', async (method, path) => {
    const response = await request(path, undefined, {
      method,
      body: method === 'POST' ? '{}' : null,
    });

    expect(response.status).toBe(401);
  });

  it('returns buy and sell rates', async () => {
    const token = await signIn();
    const body: ExchangeRate = await (await request('/api/exchange-rate', token)).json();

    expect(body).toMatchObject({ buy: 60.2, sell: 61.4 });
  });

  it('lists the saved beneficiaries', async () => {
    const token = await signIn();
    const body: { beneficiaries: Beneficiary[] } = await (
      await request('/api/beneficiaries', token)
    ).json();

    expect(body.beneficiaries.map((beneficiary) => beneficiary.alias)).toEqual([
      'Maria Perez',
      'Juan Rodriguez',
      'Ana Martinez',
    ]);
  });

  it('looks up another customer with a masked name', async () => {
    const token = await signIn();
    const response = await request(`/api/accounts/lookup?number=${PEDRO}`, token);
    const body: AccountLookup = await response.json();

    expect(body).toEqual({ accountNumber: PEDRO, holderName: 'Pedro G.', currency: 'DOP' });
  });

  it.each([
    [
      '2004587219874',
      422,
      'OWN_ACCOUNT',
      'This is one of your accounts. Choose it under My accounts.',
    ],
    ['123', 404, 'ACCOUNT_NOT_FOUND', "We couldn't find that account."],
  ])('rejects the lookup of %s', async (number, status, code, message) => {
    const token = await signIn();
    const response = await request(`/api/accounts/lookup?number=${number}`, token);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ code, message });
  });

  it('returns a quote', async () => {
    const token = await signIn();

    expect(await quote(token, own('1500.50'))).toMatchObject({
      debit: 1500.5,
      credit: 1500.5,
      requiresOtp: false,
    });
  });

  it('rejects an invalid quote with the field to fix', async () => {
    const token = await signIn();
    const response = await request('/api/transfers/quote', token, {
      method: 'POST',
      body: JSON.stringify(own('abc')),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR', field: 'amount' });
  });

  it('moves money between own accounts and records both sides', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1500.50'));

    const response = await confirm(token, { quoteId });
    const receipt: TransferReceipt = await response.json();

    expect(response.status).toBe(200);
    expect(receipt.reference).toMatch(/^TRF-\d{8}-[A-Z0-9]{6}$/);
    expect(balance('acc-dop-savings')).toBe(143730);
    expect(balance('acc-dop-checking')).toBe(40440.5);
    const [out, incoming] = db.transactions.filter((transaction) =>
      transaction.id.startsWith(`trf-${receipt.reference}`),
    );
    expect(out).toMatchObject({ type: 'debit', amount: 1500.5, accountId: 'acc-dop-savings' });
    expect(incoming).toMatchObject({
      type: 'credit',
      amount: 1500.5,
      accountId: 'acc-dop-checking',
    });
    expect(out.date).toBe(incoming.date);
    expect(out.description).toBe('Transfer to Checking DOP **** 9874');
    expect(incoming.description).toBe('Transfer from Savings DOP **** 4521');
  });

  it('returns the same receipt for a repeated key and moves money once', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1000'));
    const key = crypto.randomUUID();

    const first: TransferReceipt = await (await confirm(token, { quoteId }, key)).json();
    const second = await confirm(token, { quoteId }, key);

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(first);
    expect(balance('acc-dop-savings')).toBe(144230.5);
  });

  it('rejects a used quote with a new key', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1000'));
    await confirm(token, { quoteId });

    const response = await confirm(token, { quoteId });

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe('QUOTE_USED');
  });

  it('rejects an expired quote', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1000'));
    db.quotes[quoteId].quote.expiresAt = new Date(Date.now() - 1).toISOString();

    const response = await confirm(token, { quoteId });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: 'QUOTE_EXPIRED',
      message: 'This quote has expired. Review the transfer again.',
    });
  });

  it('locks a third-party quote after three wrong codes', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, toMaria('1000'));

    const attempts: ApiErrorBody[] = [];
    for (const otp of [undefined, '000000']) {
      const response = await confirm(token, { quoteId, otp });
      expect(response.status).toBe(422);
      attempts.push(await response.json());
    }
    const locked = await confirm(token, { quoteId, otp: '111111' });
    const afterLock = await confirm(token, { quoteId, otp: '123456' });

    expect(attempts).toEqual([
      { code: 'INVALID_OTP', message: 'Incorrect code.', attemptsRemaining: 2 },
      { code: 'INVALID_OTP', message: 'Incorrect code.', attemptsRemaining: 1 },
    ]);
    expect(locked.status).toBe(423);
    expect(await locked.json()).toMatchObject({
      code: 'OTP_LOCKED',
      message: 'Too many attempts. Start a new transfer.',
    });
    expect(afterLock.status).toBe(409);
    expect((await afterLock.json()).code).toBe('QUOTE_EXPIRED');
    expect(balance('acc-dop-savings')).toBe(145230.5);
  });

  it('sends to a third party with the right code', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, toMaria('1000'));

    const response = await confirm(token, { quoteId, otp: '123456' });

    expect(response.status).toBe(200);
    expect(balance('acc-dop-savings')).toBe(144230.5);
    expect(db.transactions.at(-1)).toMatchObject({
      description: 'Transfer to Maria P.',
      type: 'debit',
    });
  });

  it('saves a new beneficiary once', async () => {
    const token = await signIn();
    for (let i = 0; i < 2; i++) {
      const { quoteId } = await quote(token, {
        ...toMaria('100'),
        to: { type: 'third-party', accountNumber: PEDRO },
      });
      await confirm(token, { quoteId, otp: '123456', saveBeneficiary: true });
    }

    const body: { beneficiaries: Beneficiary[] } = await (
      await request('/api/beneficiaries', token)
    ).json();

    expect(body.beneficiaries).toHaveLength(4);
    expect(body.beneficiaries[3]).toMatchObject({
      alias: 'Pedro G.',
      accountNumber: PEDRO,
      holderName: 'Pedro G.',
    });
  });

  it('checks the balance again when confirming', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1000'));
    db.accounts[0].balance = 500;

    const response = await confirm(token, { quoteId });

    expect(response.status).toBe(422);
    expect((await response.json()).code).toBe('INSUFFICIENT_FUNDS');
  });

  it('keeps a confirmed transfer after a reload', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, {
      ...toMaria('100'),
      to: { type: 'third-party', accountNumber: PEDRO },
    });
    await confirm(token, { quoteId, otp: '123456', saveBeneficiary: true });

    restoreDb();

    expect(balance('acc-dop-savings')).toBe(145130.5);
    expect(db.transfers).toHaveLength(1);
    expect(db.beneficiaries).toHaveLength(4);
    expect(db.transactions.at(-1)?.description).toBe('Transfer to Pedro G.');
  });

  it('reports the transfer limits and what is left today', async () => {
    const token = await signIn();
    const limits = async () => (await request('/api/transfers/limits', token)).json();

    expect(await limits()).toEqual({ perTransfer: 100000, daily: 250000, dailyRemaining: 250000 });

    const { quoteId } = await quote(token, toMaria('1000'));
    await confirm(token, { quoteId, otp: '123456' });

    expect((await limits()).dailyRemaining).toBe(249000);
  });

  it('returns the receipt to two simultaneous requests with the same key', async () => {
    const token = await signIn();
    const { quoteId } = await quote(token, own('1000'));
    const key = crypto.randomUUID();

    const responses = await Promise.all([
      confirm(token, { quoteId }, key),
      confirm(token, { quoteId }, key),
    ]);
    const [first, second]: TransferReceipt[] = await Promise.all(
      responses.map((response) => response.json()),
    );

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(second).toEqual(first);
    expect(balance('acc-dop-savings')).toBe(144230.5);
  });
});
