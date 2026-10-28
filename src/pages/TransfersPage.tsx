import { StepIndicator } from '../components/transfers/StepIndicator';

export type TransferStep = 'form' | 'review' | 'otp' | 'receipt';

export function TransfersPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Transfers</h1>
      <section
        aria-labelledby="transfer-step-heading"
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <StepIndicator current={1} total={4} />
        <h2
          id="transfer-step-heading"
          tabIndex={-1}
          className="text-lg font-semibold text-slate-900 focus-visible:outline-none"
        >
          New transfer
        </h2>
      </section>
    </main>
  );
}
