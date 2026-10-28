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
  buy: number;
  sell: number;
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

export interface Beneficiary {
  id: string;
  alias: string;
  accountNumber: string;
  holderName: string;
  currency: Currency;
}

export interface AccountLookup {
  accountNumber: string;
  holderName: string;
  currency: Currency;
}

export type TransferDestination =
  | { type: 'own'; accountId: string }
  | { type: 'third-party'; accountNumber: string };

export interface TransferQuoteRequest {
  fromAccountId: string;
  to: TransferDestination;
  amount: string;
  description?: string;
}

export interface TransferQuote {
  quoteId: string;
  from: { accountId: string; currency: Currency };
  to: { accountNumber: string; holderName: string; currency: Currency; own: boolean };
  debit: number;
  credit: number;
  rate: { value: number; side: 'buy' | 'sell' } | null;
  description: string | null;
  requiresOtp: boolean;
  expiresAt: string;
  dailyRemaining: number | null;
}

export interface TransferConfirmRequest {
  quoteId: string;
  otp?: string;
  saveBeneficiary?: boolean;
}

export interface TransferReceipt extends Omit<
  TransferQuote,
  'quoteId' | 'expiresAt' | 'requiresOtp'
> {
  reference: string;
  createdAt: string;
}

export interface TransferLimits {
  perTransfer: number;
  daily: number;
  dailyRemaining: number;
}
