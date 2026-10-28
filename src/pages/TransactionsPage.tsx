import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { SectionError } from '../components/dashboard/SectionError';
import { Skeleton } from '../components/dashboard/Skeleton';
import { Pagination } from '../components/transactions/Pagination';
import { TransactionFilters } from '../components/transactions/TransactionFilters';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { useBalanceVisibility } from '../hooks/useBalanceVisibility';
import { useAccounts, useTransactionPage } from '../hooks/useBankingQueries';
import { useTransactionFilters } from '../hooks/useTransactionFilters';
import { exportTransactions } from '../services/bankingService';
import type { TransactionFilters as Filters } from '../types/banking';
import { bankDateKey } from '../utils/dates';
import { saveBlob } from '../utils/download';

const PAGE_SIZE = 10;

function exportFileName(): string {
  return `altura-transactions-${bankDateKey(new Date().toISOString())}.csv`;
}

export function TransactionsPage() {
  const { filters, page, hasFilters, setFilter, setPage, clearFilters } = useTransactionFilters();
  const { hidden } = useBalanceVisibility();
  const accountsQuery = useAccounts();
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const transactionsQuery = useTransactionPage(
    { ...filters, page, pageSize: PAGE_SIZE },
    { enabled: !invalidRange },
  );
  const exportMutation = useMutation({
    mutationFn: (exportFilters: Filters) => exportTransactions(exportFilters),
    onSuccess: (blob) => saveBlob(blob, exportFileName()),
  });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rangeErrorId = useId();

  const data = invalidRange ? undefined : transactionsQuery.data;
  const isBusy =
    !invalidRange && (transactionsQuery.isPending || transactionsQuery.isPlaceholderData);

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page, setPage]);

  function changePage(nextPage: number) {
    setPage(nextPage);
    headingRef.current?.focus();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
        <button
          type="button"
          onClick={() => exportMutation.mutate(filters)}
          disabled={invalidRange || exportMutation.isPending}
          aria-busy={exportMutation.isPending}
          className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Export CSV
        </button>
      </div>

      {exportMutation.isError && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Export failed. Please try again.
        </p>
      )}

      <TransactionFilters
        accounts={accountsQuery.data ?? []}
        filters={filters}
        hasFilters={hasFilters}
        rangeErrorId={invalidRange ? rangeErrorId : undefined}
        onChange={setFilter}
        onClear={clearFilters}
      />

      <section
        aria-labelledby="transaction-list-heading"
        aria-busy={isBusy}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <h2
          id="transaction-list-heading"
          ref={headingRef}
          tabIndex={-1}
          className="px-4 pt-4 text-lg font-semibold text-slate-900 focus-visible:outline-none"
        >
          All transactions
        </h2>

        {invalidRange && (
          <p id={rangeErrorId} role="alert" className="px-4 py-10 text-center text-red-700">
            The start date must be before the end date.
          </p>
        )}

        {!invalidRange && transactionsQuery.isPending && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}

        {!invalidRange && !data && transactionsQuery.isError && (
          <div className="p-4">
            <SectionError
              message="We couldn't load your transactions."
              onRetry={() => void transactionsQuery.refetch()}
            />
          </div>
        )}

        {data && data.total === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-slate-500">No transactions match your filters.</p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {data && data.total > 0 && (
          <>
            <div className="mt-2 overflow-x-auto">
              <TransactionTable
                transactions={data.transactions}
                accounts={accountsQuery.data ?? []}
                hidden={hidden}
              />
            </div>
            <Pagination
              page={Math.min(page, data.totalPages)}
              totalPages={data.totalPages}
              total={data.total}
              pageSize={data.pageSize}
              onChange={changePage}
            />
          </>
        )}
      </section>
    </main>
  );
}
