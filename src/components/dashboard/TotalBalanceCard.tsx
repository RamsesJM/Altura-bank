import type { ExchangeRate } from '../../types/banking';
import { formatCurrency, formatHiddenAmount } from '../../utils/format';
import { SectionError } from './SectionError';

export type TotalBalanceState =
  | { status: 'loading' }
  | { status: 'ready'; total: number; exchangeRate: ExchangeRate }
  | { status: 'rate-error'; onRetry: () => void }
  | { status: 'unavailable' };

interface TotalBalanceCardProps {
  state: TotalBalanceState;
  hidden: boolean;
}

const rateDateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

export function TotalBalanceCard({ state, hidden }: TotalBalanceCardProps) {
  return (
    <section
      aria-labelledby="total-balance-heading"
      aria-busy={state.status === 'loading'}
      className="rounded-2xl bg-brand-700 p-6 text-white shadow-lg sm:p-8"
    >
      <h2 id="total-balance-heading" className="text-sm font-medium text-brand-100">
        Total balance
      </h2>

      {state.status === 'loading' && (
        <div className="mt-3 space-y-3">
          <div
            data-testid="skeleton"
            aria-hidden="true"
            className="h-10 w-56 animate-pulse rounded-lg bg-white/20"
          />
          <div aria-hidden="true" className="h-4 w-72 max-w-full animate-pulse rounded bg-white/10" />
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="mt-2 text-3xl font-semibold tracking-tight break-words sm:text-4xl">
            {hidden ? formatHiddenAmount('DOP') : formatCurrency(state.total, 'DOP')}
          </p>
          <p className="mt-3 text-sm text-brand-100">
            {`USD converted at ${formatCurrency(state.exchangeRate.usdToDop, 'DOP')} · Reference rate ${rateDateFormatter.format(new Date(state.exchangeRate.date))}`}
          </p>
        </>
      )}

      {state.status === 'rate-error' && (
        <div className="mt-3">
          <SectionError
            message="We couldn't load the exchange rate."
            onRetry={state.onRetry}
            inverted
          />
        </div>
      )}

      {state.status === 'unavailable' && (
        <p className="mt-3 text-brand-100">Total balance unavailable.</p>
      )}
    </section>
  );
}
