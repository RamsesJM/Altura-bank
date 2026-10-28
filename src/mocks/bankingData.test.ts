import { describe, expect, it } from 'vitest';
import { createTransactions } from './bankingData';

const DAY_MS = 86_400_000;
const now = Date.UTC(2026, 9, 27, 18);
const transactions = createTransactions(now);

describe('demo transactions', () => {
  it('records both sides of an internal transfer at the same time', () => {
    const outgoing = transactions.find((t) => t.description === 'Transfer to checking account');
    const incoming = transactions.find((t) => t.description === 'Transfer from savings account');

    expect(outgoing?.date).toBe(incoming?.date);
  });

  it('pays salary every 15 days', () => {
    const daysAgo = transactions
      .filter((t) => t.description === 'Payroll deposit')
      .map((t) => Math.round((now - Date.parse(t.date)) / DAY_MS));

    expect(daysAgo).toEqual([14, 29, 44, 59]);
  });
});
