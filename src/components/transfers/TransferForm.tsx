import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../services/apiClient';
import type { Account, Beneficiary, ExchangeRate, TransferQuoteRequest } from '../../types/banking';
import {
  currencySymbol,
  formatAccountLabel,
  formatCurrency,
  formatHiddenAmount,
} from '../../utils/format';
import { convert, fromCents, parseAmount } from '../../utils/money';
import { Alert } from '../Alert';
import { DestinationPicker } from './DestinationPicker';
import {
  destinationCurrency,
  type LookupState,
  NEW_ACCOUNT,
  toQuoteRequest,
  type TransferDraft,
  type TransferField,
} from './transferDraft';

const DESCRIPTION_MAX_LENGTH = 60;

interface TransferFormProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  rate?: ExchangeRate;
  dailyRemaining?: number;
  draft: TransferDraft;
  hidden: boolean;
  submitting: boolean;
  serverError: unknown;
  lookups: Record<string, LookupState>;
  onLookup: (accountNumber: string) => void;
  onChange: (draft: TransferDraft) => void;
  onSubmit: (request: TransferQuoteRequest) => void;
}

type FieldErrors = Partial<Record<TransferField, string>>;

const labelClass = 'block text-sm font-medium text-slate-700';

function fieldClass(invalid: boolean): string {
  return `mt-1.5 block min-h-11 w-full rounded-lg border bg-white px-3 py-2 text-slate-900 outline-none transition focus:ring-2 ${
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
  }`;
}

function validate(draft: TransferDraft, accounts: Account[]): FieldErrors {
  const errors: FieldErrors = {};
  const { destination } = draft;

  if (!accounts.some((account) => account.id === draft.fromAccountId)) {
    errors.from = 'Choose the account to send from.';
  }

  if (destination.type === 'own') {
    if (!destination.accountId) errors.to = 'Choose an account to send to.';
    else if (destination.accountId === draft.fromAccountId) {
      errors.to = 'Choose a different account to send to.';
    }
  } else if (!destination.beneficiaryId) {
    errors.to = 'Choose an account to send to.';
  } else if (destination.beneficiaryId === NEW_ACCOUNT && !destination.accountNumber.trim()) {
    errors.to = 'Enter an account number.';
  }

  const amount = parseAmount(draft.amount);
  if ('error' in amount) errors.amount = amount.error;

  if (draft.description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = 'Use 60 characters or fewer.';
  }

  return errors;
}

export function TransferForm({
  accounts,
  beneficiaries,
  rate,
  dailyRemaining,
  draft,
  hidden,
  submitting,
  serverError,
  lookups,
  onLookup,
  onChange,
  onSubmit,
}: TransferFormProps) {
  const id = useId();
  const [errors, setErrors] = useState<FieldErrors>({});
  const pendingFocus = useRef<TransferField | null>(null);
  const apiError = serverError instanceof ApiError ? serverError : null;
  const errorId = (field: TransferField) => `${id}-${field}-error`;

  function fieldError(field: TransferField): string | undefined {
    return errors[field] ?? (apiError?.field === field ? apiError.message : undefined);
  }

  function update(changes: Partial<TransferDraft>, field?: TransferField) {
    if (field && errors[field]) setErrors({ ...errors, [field]: undefined });
    onChange({ ...draft, ...changes });
  }

  useEffect(() => {
    if (!pendingFocus.current) return;
    document
      .querySelector<HTMLElement>(`[aria-describedby~="${errorId(pendingFocus.current)}"]`)
      ?.focus();
    pendingFocus.current = null;
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(draft, accounts);
    setErrors(nextErrors);

    const firstInvalid = (['from', 'to', 'amount', 'description'] as const).find(
      (field) => nextErrors[field],
    );
    if (firstInvalid) {
      pendingFocus.current = firstInvalid;
      return;
    }

    onSubmit(toQuoteRequest(draft));
  }

  const source = accounts.find((account) => account.id === draft.fromAccountId);
  const targetCurrency = destinationCurrency(draft.destination, accounts, beneficiaries, lookups);
  const parsedAmount = parseAmount(draft.amount);
  const estimate =
    source &&
    targetCurrency &&
    rate &&
    targetCurrency !== source.currency &&
    'cents' in parsedAmount
      ? convert(parsedAmount.cents, source.currency, targetCurrency, rate)
      : null;

  const generalError = apiError && !apiError.field ? apiError.message : null;
  const amountError = fieldError('amount');
  const descriptionError = fieldError('description');
  const fromError = fieldError('from');
  const hintIds = [
    estimate ? `${id}-estimate` : null,
    draft.destination.type === 'third-party' && dailyRemaining !== undefined ? `${id}-limit` : null,
    amountError ? errorId('amount') : null,
  ].filter(Boolean);

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      {generalError && <Alert variant="error">{generalError}</Alert>}

      <div>
        <label htmlFor={`${id}-from`} className={labelClass}>
          From
        </label>
        <select
          id={`${id}-from`}
          value={draft.fromAccountId}
          onChange={(event) => update({ fromAccountId: event.target.value }, 'from')}
          aria-invalid={fromError ? true : undefined}
          aria-describedby={fromError ? errorId('from') : undefined}
          className={fieldClass(Boolean(fromError))}
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {`${formatAccountLabel(account)} · ${
                hidden
                  ? formatHiddenAmount(account.currency)
                  : formatCurrency(account.balance, account.currency)
              }`}
            </option>
          ))}
        </select>
        {fromError && (
          <p id={errorId('from')} className="mt-1.5 text-sm text-red-700">
            {fromError}
          </p>
        )}
      </div>

      <DestinationPicker
        accounts={accounts}
        beneficiaries={beneficiaries}
        destination={draft.destination}
        saveBeneficiary={draft.saveBeneficiary}
        lookups={lookups}
        error={fieldError('to')}
        errorId={errorId('to')}
        fieldClass={fieldClass}
        onChange={(destination) => update({ destination, saveBeneficiary: false }, 'to')}
        onSaveBeneficiaryChange={(saveBeneficiary) => update({ saveBeneficiary })}
        onLookup={onLookup}
      />

      <div>
        <label htmlFor={`${id}-amount`} className={labelClass}>
          Amount
        </label>
        <div className="relative">
          {source && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center pt-1.5 text-slate-500"
            >
              {currencySymbol(source.currency)}
            </span>
          )}
          <input
            id={`${id}-amount`}
            inputMode="decimal"
            autoComplete="off"
            value={draft.amount}
            onChange={(event) => update({ amount: event.target.value }, 'amount')}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={hintIds.length ? hintIds.join(' ') : undefined}
            className={`${fieldClass(Boolean(amountError))} ${source ? 'pl-12' : ''}`}
          />
        </div>
        <div className="mt-1.5 space-y-1 text-sm">
          {estimate && targetCurrency && (
            <p id={`${id}-estimate`} aria-live="polite" className="text-slate-600">
              {`They receive about ${formatCurrency(fromCents(estimate.cents), targetCurrency)}`}
            </p>
          )}
          {draft.destination.type === 'third-party' && dailyRemaining !== undefined && (
            <p id={`${id}-limit`} className="text-slate-500">
              {`Daily limit remaining: ${formatCurrency(dailyRemaining, 'DOP')}`}
            </p>
          )}
          {amountError && (
            <p id={errorId('amount')} className="text-red-700">
              {amountError}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-description`} className={labelClass}>
          Description (optional)
        </label>
        <input
          id={`${id}-description`}
          maxLength={DESCRIPTION_MAX_LENGTH}
          autoComplete="off"
          value={draft.description}
          onChange={(event) => update({ description: event.target.value }, 'description')}
          aria-invalid={descriptionError ? true : undefined}
          aria-describedby={descriptionError ? errorId('description') : undefined}
          className={fieldClass(Boolean(descriptionError))}
        />
        {descriptionError && (
          <p id={errorId('description')} className="mt-1.5 text-sm text-red-700">
            {descriptionError}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 w-full rounded-lg bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Review transfer
      </button>
    </form>
  );
}
