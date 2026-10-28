import type { Account, Beneficiary, Currency, TransferQuoteRequest } from '../../types/banking';

export type DraftDestination =
  | { type: 'own'; accountId: string }
  | { type: 'third-party'; beneficiaryId: string; accountNumber: string };

export interface TransferDraft {
  fromAccountId: string;
  destination: DraftDestination;
  amount: string;
  description: string;
  saveBeneficiary: boolean;
}

export type TransferField = 'from' | 'to' | 'amount' | 'description';

export type LookupState =
  | { status: 'loading' }
  | { status: 'found'; holderName: string; currency: Currency }
  | { status: 'error'; message: string };

export const NEW_ACCOUNT = 'new';

export const EMPTY_DRAFT: TransferDraft = {
  fromAccountId: '',
  destination: { type: 'own', accountId: '' },
  amount: '',
  description: '',
  saveBeneficiary: false,
};

export function destinationCurrency(
  destination: DraftDestination,
  accounts: Account[],
  beneficiaries: Beneficiary[],
  lookups: Record<string, LookupState>,
): Currency | undefined {
  if (destination.type === 'own') {
    return accounts.find((account) => account.id === destination.accountId)?.currency;
  }
  if (destination.beneficiaryId === NEW_ACCOUNT) {
    const lookup = lookups[destination.accountNumber.trim()];
    return lookup?.status === 'found' ? lookup.currency : undefined;
  }
  return beneficiaries.find((beneficiary) => beneficiary.id === destination.beneficiaryId)
    ?.currency;
}

export function toQuoteRequest(draft: TransferDraft): TransferQuoteRequest {
  const { destination } = draft;
  return {
    fromAccountId: draft.fromAccountId,
    to:
      destination.type === 'own'
        ? { type: 'own', accountId: destination.accountId }
        : { type: 'third-party', accountNumber: destination.accountNumber.trim() },
    amount: draft.amount.trim(),
    description: draft.description.trim() || undefined,
  };
}
