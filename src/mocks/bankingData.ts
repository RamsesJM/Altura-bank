import type { Account, ExchangeRate, Transaction, TransactionType } from '../types/banking';

const DAY_MS = 86_400_000;

export const EXCHANGE_RATE: ExchangeRate = { usdToDop: 60.83, date: '2026-10-23' };

export function createAccounts(): Account[] {
  return [
    { id: 'acc-dop-savings', number: '2004587214521', type: 'savings', currency: 'DOP', balance: 145230.5 },
    { id: 'acc-dop-checking', number: '2004587219874', type: 'checking', currency: 'DOP', balance: 38940 },
    { id: 'acc-usd-savings', number: '2004587213307', type: 'savings', currency: 'USD', balance: 2350.75 },
  ];
}

type Template = [daysAgo: number, account: string, description: string, amount: number, type: TransactionType];

const TEMPLATES: Template[] = [
  [0, 'acc-dop-checking', 'Supermercado Nacional', 3245.8, 'debit'],
  [1, 'acc-dop-checking', 'Uber trip', 385, 'debit'],
  [2, 'acc-dop-checking', 'EDESUR electricity bill', 2870, 'debit'],
  [3, 'acc-usd-savings', 'Netflix subscription', 15.49, 'debit'],
  [4, 'acc-dop-checking', 'Farmacia Carol', 1260.35, 'debit'],
  [5, 'acc-dop-savings', 'Transfer to checking account', 15000, 'debit'],
  [5, 'acc-dop-checking', 'Transfer from savings account', 15000, 'credit'],
  [7, 'acc-dop-checking', 'Claro mobile plan', 1499, 'debit'],
  [9, 'acc-dop-checking', 'Restaurante Adrian Tropical', 2150, 'debit'],
  [11, 'acc-dop-checking', 'Shell gas station', 3000, 'debit'],
  [13, 'acc-usd-savings', 'Freelance payment', 650, 'credit'],
  [14, 'acc-dop-savings', 'Payroll deposit', 68500, 'credit'],
  [15, 'acc-dop-checking', 'CAASD water bill', 640, 'debit'],
  [17, 'acc-dop-checking', 'Jumbo supermarket', 4120.6, 'debit'],
  [19, 'acc-dop-checking', 'ATM withdrawal', 5000, 'debit'],
  [21, 'acc-usd-savings', 'Amazon purchase', 89.99, 'debit'],
  [23, 'acc-dop-checking', 'La Sirena', 2675.25, 'debit'],
  [26, 'acc-dop-savings', 'Interest earned', 412.37, 'credit'],
  [28, 'acc-dop-savings', 'Transfer to Maria Perez', 7500, 'debit'],
  [29, 'acc-dop-savings', 'Payroll deposit', 68500, 'credit'],
  [31, 'acc-dop-checking', 'Supermercado Nacional', 2980.4, 'debit'],
  [33, 'acc-dop-checking', 'EDESUR electricity bill', 2715, 'debit'],
  [36, 'acc-dop-checking', 'Claro mobile plan', 1499, 'debit'],
  [38, 'acc-usd-savings', 'Netflix subscription', 15.49, 'debit'],
  [41, 'acc-dop-checking', 'Credit card payment', 12350, 'debit'],
  [44, 'acc-dop-savings', 'Payroll deposit', 68500, 'credit'],
  [44, 'acc-usd-savings', 'Freelance payment', 650, 'credit'],
  [47, 'acc-dop-checking', 'Restaurante Adrian Tropical', 1840, 'debit'],
  [50, 'acc-dop-savings', 'Transfer from Juan Rodriguez', 4000, 'credit'],
  [54, 'acc-dop-checking', 'Shell gas station', 2500, 'debit'],
  [59, 'acc-dop-savings', 'Payroll deposit', 68500, 'credit'],
];

export function createTransactions(now: number): Transaction[] {
  const currencies = new Map(createAccounts().map((account) => [account.id, account.currency]));

  return TEMPLATES.map(([daysAgo, accountId, description, amount, type], index) => ({
    id: `txn-${String(index + 1).padStart(3, '0')}`,
    accountId,
    date: new Date(now - daysAgo * DAY_MS - (daysAgo % 8) * 3_600_000).toISOString(),
    description,
    amount,
    currency: currencies.get(accountId) ?? 'DOP',
    type,
  }));
}
