import type {
  Account,
  AccountLookup,
  Beneficiary,
  ExchangeRate,
  TransactionFilters,
  TransactionPage,
  TransferConfirmRequest,
  TransferLimits,
  TransferQuote,
  TransferQuoteRequest,
  TransferReceipt,
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
  return apiRequest<TransactionPage>(`/api/transactions${toQueryString({ ...params })}`);
}

export function exportTransactions(filters: TransactionFilters): Promise<Blob> {
  return apiDownload(`/api/transactions/export${toQueryString({ ...filters })}`);
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  const { beneficiaries } = await apiRequest<{ beneficiaries: Beneficiary[] }>(
    '/api/beneficiaries',
  );
  return beneficiaries;
}

export function lookupAccount(number: string): Promise<AccountLookup> {
  return apiRequest<AccountLookup>(`/api/accounts/lookup${toQueryString({ number })}`);
}

export function quoteTransfer(request: TransferQuoteRequest): Promise<TransferQuote> {
  return apiRequest<TransferQuote>('/api/transfers/quote', { method: 'POST', body: request });
}

export function confirmTransfer(
  request: TransferConfirmRequest,
  idempotencyKey: string,
): Promise<TransferReceipt> {
  return apiRequest<TransferReceipt>('/api/transfers', {
    method: 'POST',
    body: request,
    headers: { 'Idempotency-Key': idempotencyKey },
  });
}

export function getTransferLimits(): Promise<TransferLimits> {
  return apiRequest<TransferLimits>('/api/transfers/limits');
}
