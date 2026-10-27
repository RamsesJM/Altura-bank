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

export function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
