import type { Currency, ExchangeRate } from '../types/banking';

const AMOUNT_PATTERN = /^(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/;

export type ParsedAmount = { cents: number } | { error: string };

export interface Conversion {
  cents: number;
  rate: { value: number; side: 'buy' | 'sell' } | null;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function parseAmount(input: string): ParsedAmount {
  const value = input.trim();
  if (!value) return { error: 'Enter an amount.' };
  if (value.startsWith('-')) return { error: 'Enter an amount greater than zero.' };
  if (!AMOUNT_PATTERN.test(value)) return { error: 'Enter a valid amount.' };

  const [whole, decimals = ''] = value.replace(/,/g, '').split('.');
  if (decimals.length > 2) return { error: 'Use at most 2 decimals.' };

  const cents = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
  if (cents === 0) return { error: 'Enter an amount greater than zero.' };

  return { cents };
}

export function convert(
  cents: number,
  from: Currency,
  to: Currency,
  rate: ExchangeRate,
): Conversion {
  if (from === to) return { cents, rate: null };

  if (from === 'DOP') {
    return {
      cents: Math.floor((cents * 100) / toCents(rate.sell)),
      rate: { value: rate.sell, side: 'sell' },
    };
  }

  return {
    cents: Math.floor((cents * toCents(rate.buy)) / 100),
    rate: { value: rate.buy, side: 'buy' },
  };
}

export function toDopCents(cents: number, currency: Currency, rate: ExchangeRate): number {
  return currency === 'DOP' ? cents : Math.round((cents * toCents(rate.usdToDop)) / 100);
}
