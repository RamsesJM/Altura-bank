import type {
  Account,
  ExchangeRate,
  TransactionFilters,
  TransactionPage,
} from '../types/banking';
import { apiDownload, apiRequest } from './apiClient';

export type TransactionPageParams = TransactionFilters & { page?: number; pageSize?: number };

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function getAccounts(): Promise<Account[]> {
  const { accounts } = await apiRequest<{ accounts: Account[] }>('/api/accounts');
  return accounts;
}

export function getExchangeRate(): Promise<ExchangeRate> {
  return apiRequest<ExchangeRate>('/api/exchange-rate');
}

export function getTransactionPage(params: TransactionPageParams): Promise<TransactionPage> {
  return apiRequest<TransactionPage>(`/api/transactions${toQueryString(params)}`);
}

export function exportTransactions(filters: TransactionFilters): Promise<Blob> {
  return apiDownload(`/api/transactions/export${toQueryString({ ...filters })}`);
}
