import type { Account, Transaction } from '../../types/banking';
import { formatBankDate } from '../../utils/dates';
import { formatCurrency, formatHiddenAmount } from '../../utils/format';
import { MaskedAccountNumber } from '../dashboard/MaskedAccountNumber';

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: Account[];
  hidden: boolean;
}

export function TransactionTable({ transactions, accounts, hidden }: TransactionTableProps) {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));

  return (
    <table className="w-full text-left text-sm">
      <thead className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
        <tr>
          <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell">
            Date
          </th>
          <th scope="col" className="px-4 py-3 font-medium">
            Description
          </th>
          <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
            Account
          </th>
          <th scope="col" className="px-4 py-3 text-right font-medium">
            Amount
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {transactions.map((transaction) => {
          const account = accountsById.get(transaction.accountId);
          const isCredit = transaction.type === 'credit';
          const date = formatBankDate(transaction.date);

          return (
            <tr key={transaction.id}>
              <td className="hidden px-4 py-3 whitespace-nowrap text-slate-600 sm:table-cell">
                {date}
              </td>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{transaction.description}</p>
                <p className="text-xs text-slate-500 sm:hidden">{date}</p>
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                {account && (
                  <MaskedAccountNumber number={account.number} className="font-mono text-slate-600" />
                )}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                  isCredit ? 'text-emerald-700' : 'text-slate-800'
                }`}
              >
                <span className="sr-only">{isCredit ? 'Credit ' : 'Debit '}</span>
                {hidden
                  ? formatHiddenAmount(transaction.currency)
                  : `${isCredit ? '+' : '−'}${formatCurrency(transaction.amount, transaction.currency)}`}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
