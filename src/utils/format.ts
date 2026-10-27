import type { Currency } from '../types/banking';

export function formatCurrency(amount: number, currency: Currency): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function maskAccountNumber(number: string): string {
  return `**** ${number.slice(-4)}`;
}
