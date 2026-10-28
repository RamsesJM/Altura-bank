import type { Account, TransferQuote } from '../../types/banking';
import { formatAccountLabel, formatCurrency, maskAccountNumber } from '../../utils/format';

type TransferDetails = Pick<
  TransferQuote,
  'from' | 'to' | 'debit' | 'credit' | 'rate' | 'description'
>;

interface TransferSummaryProps {
  transfer: TransferDetails;
  accounts: Account[];
  extraRows?: { label: string; value: string }[];
}

function accountName(accounts: Account[], predicate: (account: Account) => boolean): string {
  const account = accounts.find(predicate);
  return account ? formatAccountLabel(account) : '';
}

export function TransferSummary({ transfer, accounts, extraRows = [] }: TransferSummaryProps) {
  const rows = [
    ...extraRows,
    {
      label: 'From',
      value: accountName(accounts, (account) => account.id === transfer.from.accountId),
    },
    {
      label: 'To',
      value: transfer.to.own
        ? accountName(accounts, (account) => account.number === transfer.to.accountNumber)
        : maskAccountNumber(transfer.to.accountNumber),
    },
    ...(transfer.to.own ? [] : [{ label: 'Account holder', value: transfer.to.holderName }]),
    { label: 'Amount sent', value: formatCurrency(transfer.debit, transfer.from.currency) },
    ...(transfer.rate
      ? [
          {
            label: 'Exchange rate',
            value: `1 USD = ${transfer.rate.value.toFixed(2)} DOP`,
          },
          { label: 'They receive', value: formatCurrency(transfer.credit, transfer.to.currency) },
        ]
      : []),
    ...(transfer.description ? [{ label: 'Description', value: transfer.description }] : []),
  ];

  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {rows.map((row) => (
        <div key={row.label} className="flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-3">
          <dt className="text-sm text-slate-500">{row.label}</dt>
          <dd className="text-sm font-medium break-words text-slate-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
