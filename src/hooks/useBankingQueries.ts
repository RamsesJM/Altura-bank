import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getAccounts,
  getExchangeRate,
  getTransactionPage,
  type TransactionPageParams,
} from '../services/bankingService';

const RECENT_TRANSACTIONS: TransactionPageParams = { pageSize: 5 };

export const queryKeys = {
  accounts: ['accounts'] as const,
  exchangeRate: ['exchange-rate'] as const,
  transactionPage: (params: TransactionPageParams) => ['transactions', params] as const,
};

export function useAccounts() {
  return useQuery({ queryKey: queryKeys.accounts, queryFn: getAccounts });
}

export function useExchangeRate() {
  return useQuery({ queryKey: queryKeys.exchangeRate, queryFn: getExchangeRate });
}

export function useRecentTransactions() {
  return useQuery({
    queryKey: queryKeys.transactionPage(RECENT_TRANSACTIONS),
    queryFn: () => getTransactionPage(RECENT_TRANSACTIONS),
  });
}

export function useTransactionPage(params: TransactionPageParams, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.transactionPage(params),
    queryFn: () => getTransactionPage(params),
    placeholderData: keepPreviousData,
    enabled,
  });
}
