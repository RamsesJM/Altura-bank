import type { ReactNode } from 'react';
import type { Account, TransferQuote } from '../../types/banking';
import { formatCountdown } from '../../utils/format';
import { TransferSummary } from './TransferSummary';

interface TransferReviewProps {
  quote: TransferQuote;
  accounts: Account[];
  remainingMs: number;
  busy: boolean;
  message?: ReactNode;
  onEdit: () => void;
  onConfirm: () => void;
  onRequote: () => void;
}

const primaryButton =
  'min-h-11 flex-1 rounded-lg bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60';
const secondaryButton =
  'min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60';

export function TransferReview({
  quote,
  accounts,
  remainingMs,
  busy,
  message,
  onEdit,
  onConfirm,
  onRequote,
}: TransferReviewProps) {
  const expired = remainingMs === 0;

  return (
    <div className="space-y-5">
      <TransferSummary transfer={quote} accounts={accounts} />

      {expired ? (
        <p role="status" className="text-sm font-medium text-amber-700">
          This quote has expired.
        </p>
      ) : (
        <p className="text-sm text-slate-500">
          {`This quote expires in ${formatCountdown(remainingMs)}`}
        </p>
      )}

      {message}

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onEdit} disabled={busy} className={secondaryButton}>
          Edit
        </button>
        {expired ? (
          <button type="button" onClick={onRequote} disabled={busy} className={primaryButton}>
            Get a new quote
          </button>
        ) : (
          <button type="button" onClick={onConfirm} disabled={busy} className={primaryButton}>
            Confirm transfer
          </button>
        )}
      </div>
    </div>
  );
}
