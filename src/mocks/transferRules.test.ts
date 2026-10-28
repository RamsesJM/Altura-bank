import { describe, expect, it } from 'vitest';
import type { TransferQuoteRequest } from '../types/banking';
import { createAccounts, createDirectory, EXCHANGE_RATE } from './bankingData';
import type { StoredTransfer } from './db';
import { dailyUsed, maskHolderName, quoteTransfer } from './transferRules';

const NOW = Date.parse('2026-10-28T16:00:00.000Z');
const MARIA = '3001458820147';

function state(transfers: StoredTransfer[] = []) {
  return {
    accounts: createAccounts(),
    directory: createDirectory(),
    transfers,
    rate: EXCHANGE_RATE,
  };
}

function storedTransfer(createdAt: string, thirdPartyDop: number): StoredTransfer {
  return {
    idempotencyKey: createdAt,
    quoteId: createdAt,
    thirdPartyDop,
    receipt: { createdAt } as StoredTransfer['receipt'],
  };
}

function own(amount: string, accountId = 'acc-dop-checking'): TransferQuoteRequest {
  return { fromAccountId: 'acc-dop-savings', to: { type: 'own', accountId }, amount };
}

function thirdParty(amount: string, accountNumber = MARIA, fromAccountId = 'acc-dop-savings') {
  return { fromAccountId, to: { type: 'third-party', accountNumber }, amount } as const;
}

function quote(request: TransferQuoteRequest, transfers?: StoredTransfer[]) {
  const result = quoteTransfer(state(transfers), request, NOW);
  if (!result.ok) throw new Error(`Expected a quote, got ${result.error.code}`);
  return result.quote;
}

function failure(request: TransferQuoteRequest, transfers?: StoredTransfer[]) {
  const result = quoteTransfer(state(transfers), request, NOW);
  if (result.ok) throw new Error('Expected an error');
  return { status: result.status, ...result.error };
}

describe('maskHolderName', () => {
  it('keeps the first name and the initial of the last name', () => {
    expect(maskHolderName('Maria Perez')).toBe('Maria P.');
    expect(maskHolderName('Ana')).toBe('Ana');
  });
});

describe('quoteTransfer', () => {
  it('quotes a transfer between own accounts in the same currency', () => {
    expect(quote(own('1500.50'))).toMatchObject({
      from: { accountId: 'acc-dop-savings', currency: 'DOP' },
      to: { accountNumber: '2004587219874', currency: 'DOP', own: true },
      debit: 1500.5,
      credit: 1500.5,
      rate: null,
      description: null,
      requiresOtp: false,
      dailyRemaining: null,
      expiresAt: new Date(NOW + 300_000).toISOString(),
    });
  });

  it('converts DOP to USD at the sell rate', () => {
    expect(quote(own('100000', 'acc-usd-savings'))).toMatchObject({
      debit: 100000,
      credit: 1628.66,
      rate: { value: 61.4, side: 'sell' },
    });
  });

  it('quotes a third-party transfer with a code and the daily limit left', () => {
    expect(quote(thirdParty('1000'))).toMatchObject({
      to: { accountNumber: MARIA, holderName: 'Maria P.', currency: 'DOP', own: false },
      requiresOtp: true,
      dailyRemaining: 249000,
    });
  });

  it('trims the description and drops an empty one', () => {
    expect(quote({ ...own('10'), description: '  Rent  ' }).description).toBe('Rent');
    expect(quote({ ...own('10'), description: '   ' }).description).toBeNull();
  });

  it('gives every quote its own id', () => {
    expect(quote(own('10')).quoteId).not.toBe(quote(own('10')).quoteId);
  });

  it.each([
    [
      { ...own('10'), fromAccountId: 'acc-unknown' },
      400,
      'VALIDATION_ERROR',
      'from',
      'Choose the account to send from.',
    ],
    [own('abc'), 400, 'VALIDATION_ERROR', 'amount', 'Enter a valid amount.'],
    [
      { ...own('10'), description: 'x'.repeat(61) },
      400,
      'VALIDATION_ERROR',
      'description',
      'Use 60 characters or fewer.',
    ],
    [
      own('10', 'acc-dop-savings'),
      422,
      'SAME_ACCOUNT',
      'to',
      'Choose a different account to send to.',
    ],
    [
      thirdParty('10', '3009999999999'),
      404,
      'ACCOUNT_NOT_FOUND',
      'to',
      "We couldn't find that account.",
    ],
    [
      thirdParty('10', '2004587219874'),
      422,
      'OWN_ACCOUNT',
      'to',
      'This is one of your accounts. Choose it under My accounts.',
    ],
    [
      own('145230.51'),
      422,
      'INSUFFICIENT_FUNDS',
      'amount',
      'The amount is more than your available balance.',
    ],
    [
      thirdParty('100000.01'),
      422,
      'LIMIT_EXCEEDED',
      'amount',
      'Transfers to other people are limited to RD$100,000.00 each.',
    ],
    [
      thirdParty('1700', MARIA, 'acc-usd-savings'),
      422,
      'LIMIT_EXCEEDED',
      'amount',
      'Transfers to other people are limited to RD$100,000.00 each.',
    ],
  ] as const)('rejects %j with %i %s', (request, status, code, field, message) => {
    expect(failure(request)).toEqual({ status, code, field, message });
  });

  it('allows exactly the per-transfer limit', () => {
    expect(quote(thirdParty('100000')).debit).toBe(100000);
  });

  it('allows the whole balance between own accounts', () => {
    expect(quote(own('145230.50')).debit).toBe(145230.5);
  });

  it('rejects a transfer over the daily limit and says how much is left', () => {
    const today = [storedTransfer('2026-10-28T13:00:00.000Z', 200000)];

    expect(failure(thirdParty('60000'), today)).toEqual({
      status: 422,
      code: 'DAILY_LIMIT_EXCEEDED',
      field: 'amount',
      message: 'This transfer is over your daily limit. You can still send RD$50,000.00 today.',
      dailyRemaining: 50000,
    });
  });
});

describe('dailyUsed', () => {
  it('counts only third-party transfers made today in Santo Domingo', () => {
    const transfers = [
      storedTransfer('2026-10-28T03:59:00.000Z', 1000),
      storedTransfer('2026-10-28T04:00:00.000Z', 2000),
      { ...storedTransfer('2026-10-28T12:00:00.000Z', 0), thirdPartyDop: null },
    ];

    expect(dailyUsed(transfers, NOW)).toBe(2000);
  });
});
