import { useEffect, useRef, useState } from 'react';
import { SectionError } from '../components/dashboard/SectionError';
import { Skeleton } from '../components/dashboard/Skeleton';
import { StepIndicator } from '../components/transfers/StepIndicator';
import { TransferForm } from '../components/transfers/TransferForm';
import {
  EMPTY_DRAFT,
  type LookupState,
  type TransferDraft,
} from '../components/transfers/transferDraft';
import { useBalanceVisibility } from '../hooks/useBalanceVisibility';
import {
  useAccountLookup,
  useAccounts,
  useBeneficiaries,
  useExchangeRate,
  useQuoteTransfer,
  useTransferLimits,
} from '../hooks/useBankingQueries';
import { ApiError } from '../services/apiClient';
import type { TransferQuote, TransferQuoteRequest } from '../types/banking';

export type TransferStep = 'form' | 'review' | 'otp' | 'receipt';

const STEP_HEADINGS: Record<TransferStep, string> = {
  form: 'New transfer',
  review: 'Review your transfer',
  otp: 'Enter your verification code',
  receipt: 'Transfer sent',
};

const LOOKUP_FAILED = "We couldn't check that account. Please try again.";

function stepNumber(step: TransferStep, thirdParty: boolean): number {
  if (step === 'form') return 1;
  if (step === 'review') return 2;
  if (step === 'otp') return 3;
  return thirdParty ? 4 : 3;
}

export function TransfersPage() {
  const { hidden } = useBalanceVisibility();
  const accountsQuery = useAccounts();
  const beneficiariesQuery = useBeneficiaries();
  const rateQuery = useExchangeRate();
  const limitsQuery = useTransferLimits();
  const quoteMutation = useQuoteTransfer();
  const lookupMutation = useAccountLookup();

  const [step, setStep] = useState<TransferStep>('form');
  const [draft, setDraft] = useState<TransferDraft>(EMPTY_DRAFT);
  const [, setQuote] = useState<TransferQuote | null>(null);
  const [, setIdempotencyKey] = useState<string | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);

  const accounts = accountsQuery.data ?? [];
  const resolvedDraft = draft.fromAccountId
    ? draft
    : { ...draft, fromAccountId: accounts[0]?.id ?? '' };
  const thirdParty = resolvedDraft.destination.type === 'third-party';

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    headingRef.current?.focus();
  }, [step]);

  function changeDraft(next: TransferDraft) {
    quoteMutation.reset();
    setDraft(next);
  }

  function lookUp(accountNumber: string) {
    const current = lookups[accountNumber];
    if (current && current.status !== 'error') return;

    setLookups((all) => ({ ...all, [accountNumber]: { status: 'loading' } }));
    lookupMutation
      .mutateAsync(accountNumber)
      .then(
        (result): LookupState => ({
          status: 'found',
          holderName: result.holderName,
          currency: result.currency,
        }),
      )
      .catch(
        (error: unknown): LookupState => ({
          status: 'error',
          message:
            error instanceof ApiError && error.status > 0 && error.status < 500
              ? error.message
              : LOOKUP_FAILED,
        }),
      )
      .then((state) => setLookups((all) => ({ ...all, [accountNumber]: state })));
  }

  function requestQuote(request: TransferQuoteRequest) {
    quoteMutation.mutate(request, {
      onSuccess: (quote) => {
        setQuote(quote);
        setIdempotencyKey(crypto.randomUUID());
        setStep('review');
      },
    });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Transfers</h1>
      <section
        aria-labelledby="transfer-step-heading"
        aria-busy={accountsQuery.isPending}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <StepIndicator current={stepNumber(step, thirdParty)} total={thirdParty ? 4 : 3} />
        <h2
          id="transfer-step-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-lg font-semibold text-slate-900 focus-visible:outline-none"
        >
          {STEP_HEADINGS[step]}
        </h2>

        {step === 'form' && accountsQuery.isPending && (
          <div className="space-y-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-11" />
            ))}
          </div>
        )}

        {step === 'form' && accountsQuery.isError && (
          <SectionError
            message="We couldn't load your accounts."
            onRetry={() => void accountsQuery.refetch()}
          />
        )}

        {step === 'form' && accountsQuery.data && (
          <TransferForm
            accounts={accounts}
            beneficiaries={beneficiariesQuery.data ?? []}
            rate={rateQuery.data}
            dailyRemaining={limitsQuery.data?.dailyRemaining}
            draft={resolvedDraft}
            hidden={hidden}
            submitting={quoteMutation.isPending}
            serverError={quoteMutation.error}
            lookups={lookups}
            onLookup={lookUp}
            onChange={changeDraft}
            onSubmit={requestQuote}
          />
        )}
      </section>
    </main>
  );
}
