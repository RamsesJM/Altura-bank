import { useEffect, useRef } from 'react';
import { SectionError } from '../components/dashboard/SectionError';
import { Skeleton } from '../components/dashboard/Skeleton';
import { Pagination } from '../components/transactions/Pagination';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { useBalanceVisibility } from '../hooks/useBalanceVisibility';
import { useAccounts, useTransactionPage } from '../hooks/useBankingQueries';
import { useTransactionFilters } from '../hooks/useTransactionFilters';

const PAGE_SIZE = 10;

export function TransactionsPage() {
  const { filters, page, hasFilters, setPage, clearFilters } = useTransactionFilters();
  const { hidden } = useBalanceVisibility();
  const accountsQuery = useAccounts();
  const transactionsQuery = useTransactionPage({ ...filters, page, pageSize: PAGE_SIZE });
  const headingRef = useRef<HTMLHeadingElement>(null);

  const data = transactionsQuery.data;
  const isBusy = transactionsQuery.isPending || transactionsQuery.isPlaceholderData;

  useEffect(() => {
    if (data && page > data.totalPages) setPage(data.totalPages);
  }, [data, page, setPage]);

  function changePage(nextPage: number) {
    setPage(nextPage);
    headingRef.current?.focus();
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>

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

        {transactionsQuery.isPending && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}

        {!data && transactionsQuery.isError && (
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
