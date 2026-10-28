import { Link } from 'react-router';
import { AccountCard } from '../components/dashboard/AccountCard';
import { BalanceToggle } from '../components/dashboard/BalanceToggle';
import {
  RecentTransactions,
  type RecentTransactionsState,
} from '../components/dashboard/RecentTransactions';
import { SectionError } from '../components/dashboard/SectionError';
import { Skeleton } from '../components/dashboard/Skeleton';
import {
  TotalBalanceCard,
  type TotalBalanceState,
} from '../components/dashboard/TotalBalanceCard';
import { useAuth } from '../hooks/useAuth';
import { useBalanceVisibility } from '../hooks/useBalanceVisibility';
import { useAccounts, useExchangeRate, useRecentTransactions } from '../hooks/useBankingQueries';
import { totalBalanceInDop } from '../utils/balance';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

export function DashboardPage() {
  const { user } = useAuth();
  const accountsQuery = useAccounts();
  const exchangeRateQuery = useExchangeRate();
  const transactionsQuery = useRecentTransactions();
  const { hidden, toggle } = useBalanceVisibility();

  if (!user) return null;

  const firstName = user.fullName.split(' ')[0];
  const accounts = accountsQuery.data ?? [];

  let totalState: TotalBalanceState;
  if (accountsQuery.data && exchangeRateQuery.data) {
    totalState = {
      status: 'ready',
      total: totalBalanceInDop(accountsQuery.data, exchangeRateQuery.data.usdToDop),
      exchangeRate: exchangeRateQuery.data,
    };
  } else if (accountsQuery.isError) {
    totalState = { status: 'unavailable' };
  } else if (exchangeRateQuery.isError) {
    totalState = { status: 'rate-error', onRetry: () => void exchangeRateQuery.refetch() };
  } else {
    totalState = { status: 'loading' };
  }

  let transactionsState: RecentTransactionsState;
  if (transactionsQuery.data) {
    transactionsState = { status: 'ready', transactions: transactionsQuery.data.transactions };
  } else if (transactionsQuery.isError) {
    transactionsState = { status: 'error', onRetry: () => void transactionsQuery.refetch() };
  } else {
    transactionsState = { status: 'loading' };
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {user.lastLoginAt
              ? `Last login: ${dateFormatter.format(new Date(user.lastLoginAt))}`
              : 'This is your first sign-in'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BalanceToggle hidden={hidden} onToggle={toggle} />
          <Link
            to="/transfers"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            New transfer
          </Link>
        </div>
      </div>

      <TotalBalanceCard state={totalState} hidden={hidden} />

      <section aria-labelledby="accounts-heading" aria-busy={accountsQuery.isPending}>
        <h2 id="accounts-heading" className="mb-3 text-lg font-semibold text-slate-900">
          Your accounts
        </h2>

        {accountsQuery.isPending && (
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40" />
            ))}
          </div>
        )}

        {accountsQuery.isError && !accountsQuery.data && (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionError
              message="We couldn't load your accounts."
              onRetry={() => void accountsQuery.refetch()}
            />
          </div>
        )}

        {accountsQuery.data && (
          <div className="grid gap-4 md:grid-cols-3">
            {accountsQuery.data.map((account) => (
              <AccountCard key={account.id} account={account} hidden={hidden} />
            ))}
          </div>
        )}
      </section>

      <RecentTransactions state={transactionsState} accounts={accounts} hidden={hidden} />
    </main>
  );
}
