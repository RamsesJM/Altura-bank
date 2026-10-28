import { useId } from 'react';
import type { Account, Beneficiary } from '../../types/banking';
import { formatAccountLabel, maskAccountNumber } from '../../utils/format';
import { type DraftDestination, type LookupState, NEW_ACCOUNT } from './transferDraft';

interface DestinationPickerProps {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  destination: DraftDestination;
  saveBeneficiary: boolean;
  lookups: Record<string, LookupState>;
  error?: string;
  errorId: string;
  fieldClass: (invalid: boolean) => string;
  onChange: (destination: DraftDestination) => void;
  onSaveBeneficiaryChange: (save: boolean) => void;
  onLookup: (accountNumber: string) => void;
}

const labelClass = 'block text-sm font-medium text-slate-700';

export function DestinationPicker({
  accounts,
  beneficiaries,
  destination,
  saveBeneficiary,
  lookups,
  error,
  errorId,
  fieldClass,
  onChange,
  onSaveBeneficiaryChange,
  onLookup,
}: DestinationPickerProps) {
  const id = useId();
  const tabs = [
    { type: 'own', label: 'My accounts' },
    { type: 'third-party', label: 'Someone else' },
  ] as const;

  const accountNumber = destination.type === 'third-party' ? destination.accountNumber.trim() : '';
  const isNewAccount =
    destination.type === 'third-party' && destination.beneficiaryId === NEW_ACCOUNT;
  const lookup = isNewAccount && accountNumber ? lookups[accountNumber] : undefined;
  const lookupError = lookup?.status === 'error' ? lookup.message : undefined;
  const shownError = error ?? lookupError;
  const alreadySaved = beneficiaries.some(
    (beneficiary) => beneficiary.accountNumber === accountNumber,
  );

  function selectTab(type: DraftDestination['type']) {
    if (type === destination.type) return;
    onChange(
      type === 'own'
        ? { type: 'own', accountId: '' }
        : { type: 'third-party', beneficiaryId: '', accountNumber: '' },
    );
  }

  function selectBeneficiary(beneficiaryId: string) {
    const beneficiary = beneficiaries.find((item) => item.id === beneficiaryId);
    onChange({
      type: 'third-party',
      beneficiaryId,
      accountNumber: beneficiary?.accountNumber ?? '',
    });
  }

  return (
    <fieldset className="space-y-3">
      <legend className={labelClass}>To</legend>
      <div role="tablist" aria-label="Send to" className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((tab) => {
          const selected = destination.type === tab.type;
          return (
            <button
              key={tab.type}
              type="button"
              role="tab"
              id={`${id}-${tab.type}-tab`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              onClick={() => selectTab(tab.type)}
              className={`min-h-11 flex-1 rounded-md px-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                selected
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-${destination.type}-tab`}
        className="space-y-3"
      >
        {destination.type === 'own' ? (
          <div>
            <label htmlFor={`${id}-own`} className={labelClass}>
              To account
            </label>
            <select
              id={`${id}-own`}
              value={destination.accountId}
              onChange={(event) => onChange({ type: 'own', accountId: event.target.value })}
              aria-invalid={shownError ? true : undefined}
              aria-describedby={shownError ? errorId : undefined}
              className={fieldClass(Boolean(shownError))}
            >
              <option value="">Choose an account</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {formatAccountLabel(account)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label htmlFor={`${id}-beneficiary`} className={labelClass}>
                Beneficiary
              </label>
              <select
                id={`${id}-beneficiary`}
                value={destination.beneficiaryId}
                onChange={(event) => selectBeneficiary(event.target.value)}
                aria-invalid={shownError && !isNewAccount ? true : undefined}
                aria-describedby={shownError && !isNewAccount ? errorId : undefined}
                className={fieldClass(Boolean(shownError) && !isNewAccount)}
              >
                <option value="">Choose a beneficiary</option>
                {beneficiaries.map((beneficiary) => (
                  <option key={beneficiary.id} value={beneficiary.id}>
                    {`${beneficiary.alias} · ${maskAccountNumber(beneficiary.accountNumber)} · ${beneficiary.currency}`}
                  </option>
                ))}
                <option value={NEW_ACCOUNT}>New account number</option>
              </select>
            </div>

            {isNewAccount && (
              <div>
                <label htmlFor={`${id}-number`} className={labelClass}>
                  Account number
                </label>
                <input
                  id={`${id}-number`}
                  inputMode="numeric"
                  autoComplete="off"
                  value={destination.accountNumber}
                  onChange={(event) =>
                    onChange({ ...destination, accountNumber: event.target.value })
                  }
                  onBlur={() => accountNumber && onLookup(accountNumber)}
                  aria-invalid={shownError ? true : undefined}
                  aria-describedby={shownError ? errorId : undefined}
                  className={fieldClass(Boolean(shownError))}
                />
                <div aria-live="polite" className="mt-1.5 text-sm">
                  {lookup?.status === 'loading' && (
                    <p className="text-slate-500">Checking the account…</p>
                  )}
                  {lookup?.status === 'found' && (
                    <>
                      <p className="font-medium text-slate-800">{`Account holder: ${lookup.holderName}`}</p>
                      <p className="text-slate-500">{`${lookup.currency} account`}</p>
                    </>
                  )}
                </div>
              </div>
            )}

            {isNewAccount && lookup?.status === 'found' && !alreadySaved && (
              <label className="flex min-h-11 items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={saveBeneficiary}
                  onChange={(event) => onSaveBeneficiaryChange(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-600"
                />
                Save as beneficiary
              </label>
            )}
          </>
        )}

        {shownError && (
          <p id={errorId} className="text-sm text-red-700">
            {shownError}
          </p>
        )}
      </div>
    </fieldset>
  );
}
