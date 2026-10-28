import { describe, expect, it } from 'vitest';
import type { Account, Transaction } from '../types/banking';
import { filterTransactions, paginate, toCsv } from './transactionQuery';

function tx(
  id: string,
  accountId: string,
  date: string,
  description: string,
  amount: number,
  type: Transaction['type'],
): Transaction {
  return { id, accountId, date, description, amount, type, currency: 'DOP' };
}

const t1 = tx('t1', 'acc-a', '2026-10-27T18:00:00.000Z', 'Supermercado Nacional', 100, 'debit');
const t2 = tx('t2', 'acc-b', '2026-10-26T03:59:00.000Z', 'EDESUR electricity bill', 50, 'debit');
const t3 = tx('t3', 'acc-a', '2026-10-25T12:00:00.000Z', 'Payroll deposit', 1000, 'credit');
const t4 = tx('t4', 'acc-b', '2026-10-20T12:00:00.000Z', 'Facturación eléctrica', 75.5, 'debit');
const all = [t3, t1, t4, t2];

const ids = (transactions: Transaction[]) => transactions.map((t) => t.id);

describe('filterTransactions', () => {
  it('returns every transaction newest first without filters', () => {
    expect(ids(filterTransactions(all, {}))).toEqual(['t1', 't2', 't3', 't4']);
  });

  it('filters by account', () => {
    expect(ids(filterTransactions(all, { accountId: 'acc-b' }))).toEqual(['t2', 't4']);
  });

  it('filters by type', () => {
    expect(ids(filterTransactions(all, { type: 'credit' }))).toEqual(['t3']);
  });

  it('includes the whole day when both dates are the same', () => {
    expect(ids(filterTransactions(all, { from: '2026-10-25', to: '2026-10-25' }))).toEqual([
      't2',
      't3',
    ]);
  });

  it('filters a date range in Santo Domingo time', () => {
    expect(ids(filterTransactions(all, { from: '2026-10-21', to: '2026-10-26' }))).toEqual([
      't2',
      't3',
    ]);
  });

  it('searches without caring about case', () => {
    expect(ids(filterTransactions(all, { q: 'supermercado' }))).toEqual(['t1']);
  });

  it('searches without caring about accents', () => {
    expect(ids(filterTransactions(all, { q: 'facturacion electrica' }))).toEqual(['t4']);
    expect(ids(filterTransactions(all, { q: 'ELÉCTRICA' }))).toEqual(['t4']);
  });

  it('treats special characters in the search as plain text', () => {
    expect(() => filterTransactions(all, { q: '(+' })).not.toThrow();
    expect(filterTransactions(all, { q: '(+' })).toEqual([]);
  });

  it('combines filters', () => {
    expect(ids(filterTransactions(all, { accountId: 'acc-a', type: 'credit' }))).toEqual(['t3']);
  });
});

describe('paginate', () => {
  const items = Array.from({ length: 25 }, (_, index) => index + 1);

  it('returns the requested page and totals', () => {
    expect(paginate(items, 2, 10)).toEqual({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      total: 25,
      totalPages: 3,
    });
  });

  it('returns an empty page beyond the end', () => {
    expect(paginate(items, 4, 10)).toEqual({ items: [], total: 25, totalPages: 3 });
  });

  it('reports at least one page for an empty list', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], total: 0, totalPages: 1 });
  });
});

describe('toCsv', () => {
  const accounts: Account[] = [
    { id: 'acc-a', number: '2004587219874', type: 'checking', currency: 'DOP', balance: 0 },
  ];
  const header = 'Date,Description,Account,Type,Amount,Currency';

  it('writes a header and one row per transaction', () => {
    expect(toCsv([t1, t3], accounts).split('\r\n')).toEqual([
      header,
      '2026-10-27 14:00,Supermercado Nacional,**** 9874,Debit,-100.00,DOP',
      '2026-10-25 08:00,Payroll deposit,**** 9874,Credit,1000.00,DOP',
    ]);
  });

  it('quotes commas and doubles inner quotes', () => {
    const row = toCsv([{ ...t1, description: 'Transfer from Juan "JR", Perez' }], accounts);
    expect(row).toContain('"Transfer from Juan ""JR"", Perez"');
  });

  it('neutralizes values that spreadsheets would run as formulas', () => {
    const csv = toCsv(
      [
        { ...t1, description: '=SUM(A1:A9)' },
        { ...t1, id: 'x', description: '@cmd' },
      ],
      accounts,
    );
    expect(csv).toContain(",'=SUM(A1:A9),");
    expect(csv).toContain(",'@cmd,");
  });

  it('writes only the header when there are no transactions', () => {
    expect(toCsv([], accounts)).toBe(header);
  });
});
