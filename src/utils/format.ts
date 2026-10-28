import type { Account, Currency } from '../types/banking';

const CURRENCY_SYMBOLS: Record<Currency, 'RD$' | 'US$'> = {
  DOP: 'RD$',
  USD: 'US$',
};

const amountFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function currencySymbol(currency: Currency): 'RD$' | 'US$' {
  return CURRENCY_SYMBOLS[currency];
}

export function formatCurrency(amount: number, currency: Currency): string {
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const sign = amount < 0 && rounded !== 0 ? '-' : '';
  return `${sign}${currencySymbol(currency)}${amountFormatter.format(rounded)}`;
}

export function formatHiddenAmount(currency: Currency): string {
  return `${currencySymbol(currency)} ••••••`;
}

export function maskAccountNumber(number: string): string {
  return `**** ${number.slice(-4)}`;
}

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  savings: 'Savings',
  checking: 'Checking',
};

export function formatAccountLabel(account: Account): string {
  return `${ACCOUNT_TYPE_LABELS[account.type]} ${account.currency} ${maskAccountNumber(account.number)}`;
}

export function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
