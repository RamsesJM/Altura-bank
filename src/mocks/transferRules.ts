import type { ApiErrorBody } from '../types/auth';
import type { Account, ExchangeRate, TransferQuote, TransferQuoteRequest } from '../types/banking';
import { bankDateKey } from '../utils/dates';
import { formatCurrency } from '../utils/format';
import { convert, fromCents, parseAmount, toCents, toDopCents } from '../utils/money';
import type { DirectoryAccount } from './bankingData';
import type { StoredTransfer } from './db';

export const PER_TRANSFER_LIMIT = 100_000;
export const DAILY_LIMIT = 250_000;
export const QUOTE_TTL_MS = 300_000;
export const DEMO_OTP = '123456';
export const MAX_OTP_ATTEMPTS = 3;

const DESCRIPTION_MAX_LENGTH = 60;

export interface TransferState {
  accounts: Account[];
  directory: DirectoryAccount[];
  transfers: StoredTransfer[];
  rate: ExchangeRate;
}

export type QuoteResult =
  | { ok: true; quote: TransferQuote }
  | { ok: false; status: number; error: ApiErrorBody };

function reject(status: number, error: ApiErrorBody): QuoteResult {
  return { ok: false, status, error };
}

export function maskHolderName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

export function dailyUsed(transfers: StoredTransfer[], now: number): number {
  const today = bankDateKey(new Date(now).toISOString());
  const cents = transfers
    .filter(
      (transfer) =>
        transfer.thirdPartyDop !== null && bankDateKey(transfer.receipt.createdAt) === today,
    )
    .reduce((total, transfer) => total + toCents(transfer.thirdPartyDop ?? 0), 0);
  return fromCents(cents);
}

export function quoteTransfer(
  state: TransferState,
  request: TransferQuoteRequest,
  now: number,
): QuoteResult {
  const source = state.accounts.find((account) => account.id === request.fromAccountId);
  if (!source) {
    return reject(400, {
      code: 'VALIDATION_ERROR',
      field: 'from',
      message: 'Choose the account to send from.',
    });
  }

  const amount = parseAmount(request.amount);
  if ('error' in amount) {
    return reject(400, { code: 'VALIDATION_ERROR', field: 'amount', message: amount.error });
  }

  const description = request.description?.trim() ?? '';
  if (description.length > DESCRIPTION_MAX_LENGTH) {
    return reject(400, {
      code: 'VALIDATION_ERROR',
      field: 'description',
      message: 'Use 60 characters or fewer.',
    });
  }

  let destination: TransferQuote['to'];

  if (request.to.type === 'own') {
    const { accountId } = request.to;
    const target = state.accounts.find((account) => account.id === accountId);
    if (!target) {
      return reject(404, {
        code: 'ACCOUNT_NOT_FOUND',
        field: 'to',
        message: "We couldn't find that account.",
      });
    }
    if (target.id === source.id) {
      return reject(422, {
        code: 'SAME_ACCOUNT',
        field: 'to',
        message: 'Choose a different account to send to.',
      });
    }
    destination = {
      accountNumber: target.number,
      holderName: 'You',
      currency: target.currency,
      own: true,
    };
  } else {
    const { accountNumber } = request.to;
    if (state.accounts.some((account) => account.number === accountNumber)) {
      return reject(422, {
        code: 'OWN_ACCOUNT',
        field: 'to',
        message: 'This is one of your accounts. Choose it under My accounts.',
      });
    }
    const target = state.directory.find((entry) => entry.accountNumber === accountNumber);
    if (!target) {
      return reject(404, {
        code: 'ACCOUNT_NOT_FOUND',
        field: 'to',
        message: "We couldn't find that account.",
      });
    }
    destination = {
      accountNumber,
      holderName: maskHolderName(target.holderName),
      currency: target.currency,
      own: false,
    };
  }

  if (amount.cents > toCents(source.balance)) {
    return reject(422, {
      code: 'INSUFFICIENT_FUNDS',
      field: 'amount',
      message: 'The amount is more than your available balance.',
    });
  }

  let dailyRemaining: number | null = null;

  if (!destination.own) {
    const dopCents = toDopCents(amount.cents, source.currency, state.rate);
    if (dopCents > toCents(PER_TRANSFER_LIMIT)) {
      return reject(422, {
        code: 'LIMIT_EXCEEDED',
        field: 'amount',
        message: 'Transfers to other people are limited to RD$100,000.00 each.',
      });
    }

    const availableCents = Math.max(
      0,
      toCents(DAILY_LIMIT) - toCents(dailyUsed(state.transfers, now)),
    );
    if (dopCents > availableCents) {
      return reject(422, {
        code: 'DAILY_LIMIT_EXCEEDED',
        field: 'amount',
        message: `This transfer is over your daily limit. You can still send ${formatCurrency(fromCents(availableCents), 'DOP')} today.`,
        dailyRemaining: fromCents(availableCents),
      });
    }
    dailyRemaining = fromCents(availableCents - dopCents);
  }

  const conversion = convert(amount.cents, source.currency, destination.currency, state.rate);

  return {
    ok: true,
    quote: {
      quoteId: crypto.randomUUID(),
      from: { accountId: source.id, currency: source.currency },
      to: destination,
      debit: fromCents(amount.cents),
      credit: fromCents(conversion.cents),
      rate: conversion.rate,
      description: description || null,
      requiresOtp: !destination.own,
      expiresAt: new Date(now + QUOTE_TTL_MS).toISOString(),
      dailyRemaining,
    },
  };
}
