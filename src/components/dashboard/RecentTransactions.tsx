import { Link } from 'react-router';
import type { Account, Transaction } from '../../types/banking';
import { formatCurrency, formatHiddenAmount } from '../../utils/format';
import { MaskedAccountNumber } from './MaskedAccountNumber';
import { SectionError } from './SectionError';
import { Skeleton } from './Skeleton';

export type RecentTransactionsState =
  | { status: 'loading' }
  | { status: 'error'; onRetry: () => void }
  | { status: 'ready'; transactions: Transaction[] };

interface RecentTransactionsProps {
  state: RecentTransactionsState;
  accounts: Account[];
  hidden: boolean;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

function TransactionItem({
  transaction,
  account,
  hidden,
}: {
  transaction: Transaction;
  account: Account | undefined;
  hidden: boolean;
}) {
  const { currency } = transaction;
  const isCredit = transaction.type === 'credit';

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{transaction.description}</p>
        <p className="text-sm text-slate-500">
          {dateFormatter.format(new Date(transaction.date))}
          {account && (
            <>
              {' · '}
              <MaskedAccountNumber number={account.number} className="font-mono" />
            </>
          )}
        </p>
      </div>
      <p
        className={`shrink-0 text-right font-semibold whitespace-nowrap ${
          isCredit ? 'text-emerald-700' : 'text-slate-800'
        }`}
      >
        <span className="sr-only">{isCredit ? 'Credit ' : 'Debit '}</span>
        {hidden
          ? formatHiddenAmount(currency)
          : `${isCredit ? '+' : '−'}${formatCurrency(transaction.amount, currency)}`}
      </p>
    </li>
  );
}

export function RecentTransactions({ state, accounts, hidden }: RecentTransactionsProps) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <section
      aria-labelledby="recent-transactions-heading"
      aria-busy={state.status === 'loading'}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <h2 id="recent-transactions-heading" className="text-lg font-semibold text-slate-900">
        Recent transactions
      </h2>

      <div className="mt-3">
        {state.status === 'loading' && (
          <div className="space-y-4 py-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        )}

        {state.status === 'error' && (
          <SectionError message="We couldn't load your transactions." onRetry={state.onRetry} />
        )}

        {state.status === 'ready' && state.transactions.length === 0 && (
          <p className="py-6 text-center text-slate-500">No recent transactions.</p>
        )}

        {state.status === 'ready' && state.transactions.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {state.transactions.map((transaction) => (
              <TransactionItem
                key={transaction.id}
                transaction={transaction}
                account={accountsById.get(transaction.accountId)}
                hidden={hidden}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Link
          to="/transactions"
          className="inline-flex min-h-11 items-center text-sm font-medium text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          View all transactions
        </Link>
      </div>
    </section>
  );
}
