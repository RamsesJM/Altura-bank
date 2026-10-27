import { describe, expect, it } from 'vitest';
import { formatCountdown, formatCurrency, formatHiddenAmount } from './format';

describe('formatCountdown', () => {
  it('formats milliseconds as m:ss', () => {
    expect(formatCountdown(65_000)).toBe('1:05');
  });

  it('rounds partial seconds up', () => {
    expect(formatCountdown(59_001)).toBe('1:00');
  });

  it('returns 0:00 for zero or negative values', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-5)).toBe('0:00');
  });
});

describe('formatCurrency', () => {
  it('formats Dominican pesos', () => {
    expect(formatCurrency(145230.5, 'DOP')).toBe('RD$145,230.50');
  });

  it('formats US dollars', () => {
    expect(formatCurrency(2350.75, 'USD')).toBe('US$2,350.75');
  });

  it('keeps every digit and cent for large amounts', () => {
    expect(formatCurrency(12345678.9, 'DOP')).toBe('RD$12,345,678.90');
  });

  it('places the sign before the symbol for negative amounts', () => {
    expect(formatCurrency(-50, 'DOP')).toBe('-RD$50.00');
  });
});

describe('formatHiddenAmount', () => {
  it('masks the amount but keeps the currency symbol', () => {
    expect(formatHiddenAmount('DOP')).toBe('RD$ ••••••');
    expect(formatHiddenAmount('USD')).toBe('US$ ••••••');
  });
});
