import { useEffect, useRef, useState } from 'react';
import { Alert } from '../components/Alert';
import { SectionError } from '../components/dashboard/SectionError';
import { Skeleton } from '../components/dashboard/Skeleton';
import { OtpStep } from '../components/transfers/OtpStep';
import { StepIndicator } from '../components/transfers/StepIndicator';
import { TransferForm } from '../components/transfers/TransferForm';
import { TransferReceipt } from '../components/transfers/TransferReceipt';
import { TransferReview } from '../components/transfers/TransferReview';
import {
  EMPTY_DRAFT,
  type LookupState,
  toQuoteRequest,
  type TransferDraft,
} from '../components/transfers/transferDraft';
import { useBalanceVisibility } from '../hooks/useBalanceVisibility';
import {
  useAccountLookup,
  useAccounts,
  useBeneficiaries,
  useConfirmTransfer,
  useExchangeRate,
  useQuoteTransfer,
  useTransferLimits,
} from '../hooks/useBankingQueries';
import { useCountdown } from '../hooks/useCountdown';
import { ApiError } from '../services/apiClient';
import type {
  TransferQuote,
  TransferQuoteRequest,
  TransferReceipt as Receipt,
} from '../types/banking';

export type TransferStep = 'form' | 'review' | 'otp' | 'receipt';

type ConfirmProblem = { kind: 'network' } | { kind: 'expired' } | { kind: 'message'; text: string };

const STEP_HEADINGS: Record<TransferStep, string> = {
  form: 'New transfer',
  review: 'Review your transfer',
  otp: 'Enter your verification code',
  receipt: 'Transfer sent',
};

const LOOKUP_FAILED = "We couldn't check that account. Please try again.";
const NETWORK_PROBLEM =
  "We couldn't confirm your transfer. Check your transactions before trying again.";
const EXPIRED_PROBLEM = 'This quote has expired. Review the transfer again.';
const FORM_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'INSUFFICIENT_FUNDS',
  'LIMIT_EXCEEDED',
  'DAILY_LIMIT_EXCEEDED',
  'SAME_ACCOUNT',
  'ACCOUNT_NOT_FOUND',
  'OWN_ACCOUNT',
]);

const actionButton =
  'min-h-9 rounded-md bg-white px-3 text-sm font-medium text-red-800 ring-1 ring-red-300 transition hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

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
  const confirmMutation = useConfirmTransfer();
  const lookupMutation = useAccountLookup();

  const [step, setStep] = useState<TransferStep>('form');
  const [draft, setDraft] = useState<TransferDraft>(EMPTY_DRAFT);
  const [quote, setQuote] = useState<TransferQuote | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [problem, setProblem] = useState<ConfirmProblem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [returnedError, setReturnedError] = useState<ApiError | null>(null);
  const [lookups, setLookups] = useState<Record<string, LookupState>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  const confirming = useRef(false);
  const lastCode = useRef<string | undefined>(undefined);

  const remainingMs = useCountdown(quote ? Date.parse(quote.expiresAt) : null);
  const accounts = accountsQuery.data ?? [];
  const resolvedDraft = draft.fromAccountId
    ? draft
    : { ...draft, fromAccountId: accounts[0]?.id ?? '' };
  const thirdParty = resolvedDraft.destination.type === 'third-party';
  const busy = quoteMutation.isPending || confirmMutation.isPending;

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    if (step === 'form' && returnedError?.field) return;
    headingRef.current?.focus();
  }, [step, returnedError]);

  function changeDraft(next: TransferDraft) {
    quoteMutation.reset();
    setReturnedError(null);
    setNotice(null);
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
    setReturnedError(null);
    setNotice(null);
    quoteMutation.mutate(request, {
      onSuccess: (nextQuote) => {
        setQuote(nextQuote);
        setIdempotencyKey(crypto.randomUUID());
        setProblem(null);
        setStep('review');
      },
      onError: () => setStep('form'),
    });
  }

  function backToForm(error: ApiError | null, message: string | null) {
    setQuote(null);
    setProblem(null);
    setReturnedError(error);
    setNotice(message);
    setStep('form');
  }

  function handleConfirmError(error: unknown) {
    if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) {
      setProblem({ kind: 'network' });
      return;
    }
    if (error.code === 'INVALID_OTP') {
      const left = error.attemptsRemaining ?? 0;
      setProblem({
        kind: 'message',
        text: `Incorrect code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`,
      });
    } else if (error.code === 'OTP_LOCKED') {
      backToForm(null, error.message);
    } else if (error.code === 'QUOTE_EXPIRED') {
      setProblem({ kind: 'expired' });
    } else if (FORM_ERROR_CODES.has(error.code)) {
      backToForm(error, null);
    } else if (error.code !== 'SESSION_EXPIRED') {
      setProblem({ kind: 'message', text: error.message });
    }
  }

  function confirm(code?: string) {
    if (!quote || confirming.current) return;
    confirming.current = true;
    lastCode.current = code;
    setProblem(null);

    const saveBeneficiary =
      draft.destination.type === 'third-party' && draft.saveBeneficiary ? true : undefined;

    confirmMutation.mutate(
      { request: { quoteId: quote.quoteId, otp: code, saveBeneficiary }, idempotencyKey },
      {
        onSuccess: (result) => {
          setReceipt(result);
          setStep('receipt');
        },
        onError: handleConfirmError,
        onSettled: () => {
          confirming.current = false;
        },
      },
    );
  }

  function confirmFromReview() {
    if (quote?.requiresOtp) {
      setProblem(null);
      setStep('otp');
    } else {
      confirm();
    }
  }

  function startOver() {
    setDraft(EMPTY_DRAFT);
    setQuote(null);
    setReceipt(null);
    setProblem(null);
    setNotice(null);
    setReturnedError(null);
    quoteMutation.reset();
    setStep('form');
  }

  function renderProblem() {
    if (!problem) return null;
    if (problem.kind === 'message') return <Alert variant="error">{problem.text}</Alert>;

    const expired = problem.kind === 'expired';
    return (
      <Alert variant="error">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{expired ? EXPIRED_PROBLEM : NETWORK_PROBLEM}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              expired ? requestQuote(toQuoteRequest(resolvedDraft)) : confirm(lastCode.current)
            }
            className={actionButton}
          >
            {expired ? 'Get a new quote' : 'Try again'}
          </button>
        </div>
      </Alert>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Transfers</h1>
      <section
        aria-labelledby="transfer-step-heading"
        aria-busy={accountsQuery.isPending || busy}
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
          <>
            {notice && <Alert variant="error">{notice}</Alert>}
            <TransferForm
              accounts={accounts}
              beneficiaries={beneficiariesQuery.data ?? []}
              rate={rateQuery.data}
              dailyRemaining={limitsQuery.data?.dailyRemaining}
              draft={resolvedDraft}
              hidden={hidden}
              submitting={quoteMutation.isPending}
              serverError={quoteMutation.error ?? returnedError}
              lookups={lookups}
              onLookup={lookUp}
              onChange={changeDraft}
              onSubmit={requestQuote}
            />
          </>
        )}

        {step === 'review' && quote && (
          <TransferReview
            quote={quote}
            accounts={accounts}
            remainingMs={remainingMs}
            busy={busy}
            message={renderProblem()}
            onEdit={() => setStep('form')}
            onConfirm={confirmFromReview}
            onRequote={() => requestQuote(toQuoteRequest(resolvedDraft))}
          />
        )}

        {step === 'otp' && quote && (
          <OtpStep busy={busy} message={renderProblem()} onSubmit={(code) => confirm(code)} />
        )}

        {step === 'receipt' && receipt && (
          <TransferReceipt receipt={receipt} accounts={accounts} onNewTransfer={startOver} />
        )}
      </section>
    </main>
  );
}
