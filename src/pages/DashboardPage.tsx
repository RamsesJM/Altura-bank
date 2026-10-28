import { BrandLogo } from '../components/BrandLogo';
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
  const { user, logout } = useAuth();
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
    transactionsState = { status: 'ready', transactions: transactionsQuery.data };
  } else if (transactionsQuery.isError) {
    transactionsState = { status: 'error', onRetry: () => void transactionsQuery.refetch() };
  } else {
    transactionsState = { status: 'loading' };
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-600 sm:inline">{user.fullName}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

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
          <BalanceToggle hidden={hidden} onToggle={toggle} />
        </div>

        <TotalBalanceCard state={totalState} hidden={hidden} />

        <section aria-labelledby="accounts-heading">
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
    </div>
  );
}
