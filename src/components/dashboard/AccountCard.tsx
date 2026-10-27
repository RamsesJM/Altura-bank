import type { Account } from '../../types/banking';
import { formatCurrency, formatHiddenAmount } from '../../utils/format';
import { MaskedAccountNumber } from './MaskedAccountNumber';

const ACCOUNT_LABELS: Record<Account['type'], string> = {
  savings: 'Savings account',
  checking: 'Checking account',
};

interface AccountCardProps {
  account: Account;
  hidden: boolean;
}

export function AccountCard({ account, hidden }: AccountCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium text-slate-900">{ACCOUNT_LABELS[account.type]}</h3>
          <MaskedAccountNumber
            number={account.number}
            className="mt-0.5 block font-mono text-sm text-slate-500"
          />
        </div>
        <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          {account.currency}
        </span>
      </div>
      <p className="mt-5 text-xs font-medium tracking-wide text-slate-500 uppercase">
        Available balance
      </p>
      <p className="mt-1 text-2xl font-semibold break-words text-slate-900">
        {hidden ? formatHiddenAmount(account.currency) : formatCurrency(account.balance, account.currency)}
      </p>
    </article>
  );
}
