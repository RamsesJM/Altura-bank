import type { Account, Transaction, TransactionFilters } from '../types/banking';
import { bankDateKey, formatBankDateTime } from '../utils/dates';
import { maskAccountNumber } from '../utils/format';

const CSV_HEADER = 'Date,Description,Account,Type,Amount,Currency';
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

export function filterTransactions(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const query = filters.q ? normalizeText(filters.q) : '';

  return transactions
    .filter((transaction) => {
      if (filters.accountId && transaction.accountId !== filters.accountId) return false;
      if (filters.type && transaction.type !== filters.type) return false;

      const day = bankDateKey(transaction.date);
      if (filters.from && day < filters.from) return false;
      if (filters.to && day > filters.to) return false;

      return !query || normalizeText(transaction.description).includes(query);
    })
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
}

export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number,
): { items: T[]; total: number; totalPages: number } {
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

function csvCell(value: string): string {
  const safe = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(transactions: Transaction[], accounts: Account[]): string {
  const accountNumbers = new Map(accounts.map((account) => [account.id, account.number]));

  const rows = transactions.map((transaction) => {
    const number = accountNumbers.get(transaction.accountId);
    const signedAmount = transaction.type === 'debit' ? -transaction.amount : transaction.amount;

    return [
      csvCell(formatBankDateTime(transaction.date)),
      csvCell(transaction.description),
      csvCell(number ? maskAccountNumber(number) : ''),
      transaction.type === 'credit' ? 'Credit' : 'Debit',
      signedAmount.toFixed(2),
      transaction.currency,
    ].join(',');
  });

  return [CSV_HEADER, ...rows].join('\r\n');
}
