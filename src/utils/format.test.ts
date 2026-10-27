import { describe, expect, it } from 'vitest';
import { formatCountdown } from './format';

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
