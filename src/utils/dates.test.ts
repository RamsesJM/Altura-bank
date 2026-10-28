import { describe, expect, it } from 'vitest';
import { bankDateKey, formatBankDate, formatBankDateTime } from './dates';

describe('bank dates', () => {
  it('uses Santo Domingo time for the calendar day', () => {
    expect(bankDateKey('2026-10-27T03:30:00.000Z')).toBe('2026-10-26');
    expect(bankDateKey('2026-10-27T04:00:00.000Z')).toBe('2026-10-27');
  });

  it('formats a readable date', () => {
    expect(formatBankDate('2026-10-27T03:30:00.000Z')).toBe('Oct 26, 2026');
  });

  it('formats date and time for exports', () => {
    expect(formatBankDateTime('2026-10-27T18:05:00.000Z')).toBe('2026-10-27 14:05');
  });
});
