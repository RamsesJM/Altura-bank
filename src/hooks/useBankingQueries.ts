import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  confirmTransfer,
  getAccounts,
  getBeneficiaries,
  getExchangeRate,
  getTransactionPage,
  getTransferLimits,
  lookupAccount,
  quoteTransfer,
  type TransactionPageParams,
} from '../services/bankingService';
import type { TransferConfirmRequest } from '../types/banking';

const RECENT_TRANSACTIONS: TransactionPageParams = { pageSize: 5 };

export const queryKeys = {
  accounts: ['accounts'] as const,
  exchangeRate: ['exchange-rate'] as const,
  beneficiaries: ['beneficiaries'] as const,
  transferLimits: ['transfer-limits'] as const,
  transactions: ['transactions'] as const,
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

export function useBeneficiaries() {
  return useQuery({ queryKey: queryKeys.beneficiaries, queryFn: getBeneficiaries });
}

export function useTransferLimits() {
  return useQuery({ queryKey: queryKeys.transferLimits, queryFn: getTransferLimits });
}

export function useAccountLookup() {
  return useMutation({ mutationFn: lookupAccount });
}

export function useQuoteTransfer() {
  return useMutation({ mutationFn: quoteTransfer });
}

export function useConfirmTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      request,
      idempotencyKey,
    }: {
      request: TransferConfirmRequest;
      idempotencyKey: string;
    }) => confirmTransfer(request, idempotencyKey),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.accounts }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions }),
        queryClient.invalidateQueries({ queryKey: queryKeys.beneficiaries }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transferLimits }),
      ]),
  });
}
