import type { Account } from './types/banking';
import { formatCurrency, maskAccountNumber } from './utils/format';

const previewAccount: Account = {
  id: 'acc-1',
  number: '1004587214521',
  type: 'savings',
  currency: 'BOB',
  balance: 12450.75,
};

function App() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <section className="w-full max-w-sm rounded-2xl bg-brand-700 p-6 text-white shadow-xl">
        <p className="text-sm text-brand-100">Altura Bank</p>
        <p className="mt-6 text-sm text-brand-100">Savings account</p>
        <p className="font-mono tracking-wider">{maskAccountNumber(previewAccount.number)}</p>
        <p className="mt-4 text-3xl font-semibold">
          {formatCurrency(previewAccount.balance, previewAccount.currency)}
        </p>
      </section>
    </main>
  );
}

export default App;
