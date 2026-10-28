import { Link } from 'react-router';
import type { Account, TransferReceipt as Receipt } from '../../types/banking';
import { formatBankDateTime } from '../../utils/dates';
import { TransferSummary } from './TransferSummary';

interface TransferReceiptProps {
  receipt: Receipt;
  accounts: Account[];
  onNewTransfer: () => void;
}

export function TransferReceipt({ receipt, accounts, onNewTransfer }: TransferReceiptProps) {
  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Your transfer was sent. Keep the reference for your records.
      </p>

      <TransferSummary
        transfer={receipt}
        accounts={accounts}
        extraRows={[
          { label: 'Reference', value: receipt.reference },
          { label: 'Date', value: formatBankDateTime(receipt.createdAt) },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onNewTransfer}
          className="min-h-11 flex-1 rounded-lg bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Make another transfer
        </button>
        <Link
          to="/transactions"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-slate-300 px-4 font-medium text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          View transactions
        </Link>
      </div>
    </div>
  );
}
