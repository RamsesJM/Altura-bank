import { describe, expect, it } from 'vitest';
import { EXCHANGE_RATE } from '../mocks/bankingData';
import { convert, fromCents, parseAmount, toCents, toDopCents } from './money';

describe('toCents and fromCents', () => {
  it('converts between amounts and whole cents', () => {
    expect(toCents(1500.5)).toBe(150050);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(fromCents(150050)).toBe(1500.5);
  });
});

describe('parseAmount', () => {
  it.each([
    ['1,500.50', 150050],
    [' 1500 ', 150000],
    ['0.5', 50],
    ['100000', 10000000],
  ])('reads %j as %i cents', (input, cents) => {
    expect(parseAmount(input)).toEqual({ cents });
  });

  it.each([
    ['', 'Enter an amount.'],
    ['   ', 'Enter an amount.'],
    ['abc', 'Enter a valid amount.'],
    ['1,5', 'Enter a valid amount.'],
    ['12,34,567', 'Enter a valid amount.'],
    ['0', 'Enter an amount greater than zero.'],
    ['0.00', 'Enter an amount greater than zero.'],
    ['-5', 'Enter an amount greater than zero.'],
    ['1.234', 'Use at most 2 decimals.'],
  ])('rejects %j', (input, error) => {
    expect(parseAmount(input)).toEqual({ error });
  });
});

describe('convert', () => {
  it('uses the sell rate from DOP to USD and rounds down', () => {
    expect(convert(10_000_000, 'DOP', 'USD', EXCHANGE_RATE)).toEqual({
      cents: 162866,
      rate: { value: 61.4, side: 'sell' },
    });
  });

  it('uses the buy rate from USD to DOP', () => {
    expect(convert(10_000, 'USD', 'DOP', EXCHANGE_RATE)).toEqual({
      cents: 602000,
      rate: { value: 60.2, side: 'buy' },
    });
  });

  it('rounds a single cent down', () => {
    expect(convert(1, 'USD', 'DOP', EXCHANGE_RATE).cents).toBe(60);
  });

  it('keeps the amount when the currencies match', () => {
    expect(convert(150050, 'DOP', 'DOP', EXCHANGE_RATE)).toEqual({ cents: 150050, rate: null });
  });
});

describe('toDopCents', () => {
  it('values USD at the reference rate', () => {
    expect(toDopCents(170000, 'USD', EXCHANGE_RATE)).toBe(10341100);
  });

  it('keeps DOP as is', () => {
    expect(toDopCents(150050, 'DOP', EXCHANGE_RATE)).toBe(150050);
  });
});
