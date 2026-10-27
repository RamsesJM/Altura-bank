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
  type: TransactionType;
}

export interface ExchangeRate {
  usdToDop: number;
  date: string;
}
