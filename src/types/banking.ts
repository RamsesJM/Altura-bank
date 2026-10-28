export type Currency = 'DOP' | 'USD';

export type AccountType = 'savings' | 'checking';

export interface Account {
  id: string;
  number: string;
  type: AccountType;
  currency: Currency;
  balance: number;
}

export type TransactionType = 'credit' | 'debit';

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  currency: Currency;
  type: TransactionType;
}

export interface ExchangeRate {
  usdToDop: number;
  date: string;
}

export interface TransactionFilters {
  accountId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  q?: string;
}

export interface TransactionPage {
  transactions: Transaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
