import { describe, expect, it } from 'vitest';
import type { Account } from '../types/banking';
import { totalBalanceInDop } from './balance';

function account(currency: Account['currency'], balance: number): Account {
  return { id: `${currency}-${balance}`, number: '2004587210000', type: 'savings', currency, balance };
}

describe('totalBalanceInDop', () => {
  it('converts dollars and adds every account', () => {
    const accounts = [account('DOP', 145230.5), account('DOP', 38940), account('USD', 2350.75)];
    expect(totalBalanceInDop(accounts, 60.83)).toBe(327166.62);
  });

  it('adds peso accounts without conversion', () => {
    expect(totalBalanceInDop([account('DOP', 100.1), account('DOP', 200.2)], 60.83)).toBe(300.3);
  });

  it('returns 0 without accounts', () => {
    expect(totalBalanceInDop([], 60.83)).toBe(0);
  });

  it('avoids floating point drift', () => {
    expect(totalBalanceInDop([account('USD', 0.1), account('USD', 0.2)], 1)).toBe(0.3);
  });
});
