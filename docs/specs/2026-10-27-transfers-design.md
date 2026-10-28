# Transfers

- **Status:** Approved
- **Date:** 2026-10-27
- **Version target:** v0.5.0

## Context

Users can see balances and their full history but cannot move money. This stage adds transfers between their own accounts and to other customers of the bank, with currency conversion, a review step, a one-time code for third parties, daily limits and protection against duplicate submissions. It also closes four minor findings deferred from v0.4.0.

## Goals

- Transfer between the user's own accounts, in the same or a different currency.
- Transfer to other customers of the bank, chosen from saved beneficiaries or by account number.
- Show the exact amounts and exchange rate before anything moves, and a receipt afterwards.
- Require a one-time code for third-party transfers.
- Enforce per-transfer and daily limits for third-party transfers.
- Never move money twice for one confirmation, even after a double click or a retried request.

## Non-goals

- Transfers to other banks (ACH or LBTR).
- Scheduled or recurring transfers.
- Editing or deleting beneficiaries.
- Real one-time code delivery by SMS or email.
- Warning before leaving a half-filled form.

## Business rules

| Rule | Value |
| --- | --- |
| Amount | Greater than 0, at most 2 decimals, entered in the source account currency |
| Balance | The debit cannot exceed the source account balance |
| Same account | Source and destination must be different accounts |
| Third-party limit per transfer | RD$100,000.00 |
| Third-party daily limit | RD$250,000.00 per bank day (America/Santo_Domingo), counting confirmed third-party transfers |
| Limits in USD | A USD debit counts at the reference rate (`usdToDop`) toward both limits |
| Own-account limit | Only the available balance |
| Description | Optional, trimmed, at most 60 characters |
| Quote lifetime | 5 minutes |
| One-time code | 6 digits, demo value `123456`, 3 attempts per quote |

### Currency conversion

- The exchange rate gains a buy and a sell rate next to the reference rate: `{ usdToDop: 60.83, buy: 60.20, sell: 61.40, date }`.
- DOP → USD uses the **sell** rate (the bank sells dollars): `credit = debit / sell`.
- USD → DOP uses the **buy** rate (the bank buys dollars): `credit = debit × buy`.
- All arithmetic is done in cents. The credited amount is rounded **down** to the cent, so rounding never favors the customer by a cent the bank does not have.
- Examples: RD$100,000.00 to a USD account → US$1,628.66. US$100.00 to a DOP account → RD$6,020.00.
- The dashboard's consolidated balance keeps using the reference rate.

## API contract

All endpoints require a session and use the existing `ApiError` shape. New error codes: `INSUFFICIENT_FUNDS`, `LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED`, `SAME_ACCOUNT`, `ACCOUNT_NOT_FOUND`, `OWN_ACCOUNT`, `QUOTE_EXPIRED`, `QUOTE_USED`, `INVALID_OTP`, `OTP_LOCKED`. Error bodies may include `field` (the form field the error belongs to) and `dailyRemaining` (DOP, decimal like every other amount).

### `GET /api/exchange-rate`

Adds `buy` and `sell` to the existing response.

### `GET /api/beneficiaries`

Returns `{ beneficiaries: Beneficiary[] }`.

```ts
interface Beneficiary {
  id: string;
  alias: string;          // "Maria Perez"
  accountNumber: string;
  holderName: string;     // masked: "Maria P."
  currency: Currency;
}
```

Seed: Maria Perez (DOP), Juan Rodriguez (DOP), Ana Martinez (USD). The bank directory also contains Pedro Gomez (DOP) and Laura Diaz (USD), who are not saved, to exercise adding a beneficiary.

### `GET /api/accounts/lookup?number=`

| Case | Response |
| --- | --- |
| Account of another customer | `200 { accountNumber, holderName: "Maria P.", currency }` |
| One of the user's own accounts | `422 OWN_ACCOUNT` "This is one of your accounts. Choose it under My accounts." |
| Unknown or malformed number | `404 ACCOUNT_NOT_FOUND` "We couldn't find that account." |

The holder name is masked as first name plus the initial of the last name.

### `POST /api/transfers/quote`

Request:

```ts
interface TransferQuoteRequest {
  fromAccountId: string;
  to: { type: 'own'; accountId: string } | { type: 'third-party'; accountNumber: string };
  amount: string;          // decimal string in the source currency, e.g. "1500.50"
  description?: string;
}
```

Response:

```ts
interface TransferQuote {
  quoteId: string;
  from: { accountId: string; currency: Currency };
  to: { accountNumber: string; holderName: string; currency: Currency; own: boolean };
  debit: number;           // source currency
  credit: number;          // destination currency
  rate: { value: number; side: 'buy' | 'sell' } | null;   // null when currencies match
  description: string | null;
  requiresOtp: boolean;    // true for third-party transfers
  expiresAt: string;
  dailyRemaining: number | null;   // DOP, third-party only, after this transfer
}
```

Validation failures return `400 VALIDATION_ERROR` (amount, description) or the specific codes above, with `field` set to `from`, `to`, `amount` or `description`.

### `POST /api/transfers`

Headers: `Idempotency-Key: <uuid>`. Body: `{ quoteId, otp?, saveBeneficiary? }`.

1. A key that already completed returns the same receipt with `200` and moves nothing.
2. Unknown or expired quote → `409 QUOTE_EXPIRED` "This quote has expired. Review the transfer again."
3. Quote already confirmed with another key → `409 QUOTE_USED`.
4. Third-party quote with a wrong code → `422 INVALID_OTP` with `attemptsRemaining`; the third failure returns `423 OTP_LOCKED` "Too many attempts. Start a new transfer." and invalidates the quote.
5. Balance and limits are checked again; failures return the same codes as the quote.
6. On success: debit the source, credit the destination when it is an own account, append the transactions (an own-account pair shares one timestamp), save the beneficiary if requested and new, and return the receipt.

```ts
interface TransferReceipt extends Omit<TransferQuote, 'quoteId' | 'expiresAt' | 'requiresOtp'> {
  reference: string;       // "TRF-20261027-4F7K2Q"
  createdAt: string;
}
```

Transaction descriptions: the description entered by the user when present; otherwise "Transfer to Maria P." for third parties, and "Transfer to Checking DOP **** 9874" / "Transfer from Savings DOP **** 4521" for own accounts.

## Architecture

```
src/
├── components/transfers/
│   ├── TransferForm.tsx          Step 1: source, destination, amount, description
│   ├── DestinationPicker.tsx     "My accounts" / "Someone else", beneficiaries, account lookup
│   ├── TransferReview.tsx        Step 2: summary and quote countdown
│   ├── OtpStep.tsx               Step 3: one-time code (third parties only)
│   ├── TransferReceipt.tsx       Step 4: receipt
│   └── StepIndicator.tsx
├── mocks/transferRules.ts        Pure quote, limit and masking rules used by the handlers
├── utils/money.ts                Cents, parsing and conversion
├── services/bankingService.ts    getBeneficiaries, lookupAccount, quoteTransfer, confirmTransfer
├── hooks/useBankingQueries.ts    useBeneficiaries, useAccountLookup, useQuoteTransfer, useConfirmTransfer
└── pages/TransfersPage.tsx       Step state, draft, quote and idempotency key
```

| Unit | Responsibility |
| --- | --- |
| `money.ts` | `toCents`, `fromCents`, `parseAmount(input)` → cents or an error message, `convert(cents, from, to, rates)` |
| `transferRules.ts` | `quoteTransfer(db, request, now)`, `dailyUsed(db, now)`, `maskHolderName(name)` |
| `TransfersPage` | Owns the step, the draft (kept when going back to edit) and one idempotency key per quote |
| `useConfirmTransfer` | On success invalidates accounts, transactions and beneficiaries |
| `apiClient` | `apiRequest` accepts extra headers; the new error codes are recognized |

`useCountdown` is reused for the quote expiry.

## UI

- **Entry points:** "Transfers" link in the header navigation and a "New transfer" button on the dashboard. Route `/transfers`, protected.
- **Step indicator:** "Step 1 of 4" (own-account transfers show "of 3"). Changing step moves focus to the step heading.
- **Step 1, "New transfer":**
  - "From": the user's accounts with their available balance; hidden balances are masked.
  - "To": tabs "My accounts" and "Someone else". Someone else lists saved beneficiaries and offers "Account number"; on blur the number is looked up and "Account holder: Maria P." and the currency are shown, or the lookup error. A new account shows a "Save as beneficiary" checkbox.
  - "Amount" in the source currency. Different currencies show "They receive about US$1,628.66" from the cached rate; the quote is authoritative. Third parties show "Daily limit remaining: RD$…".
  - "Description (optional)".
  - Client-side validation for empty, zero, negative, more than 2 decimals, text, same account and missing destination, without calling the server. "Review transfer" requests the quote; server errors appear on the matching field.
- **Step 2, "Review your transfer":** from, to and holder, amount sent, rate ("1 USD = 61.40 DOP"), amount received, description, and "This quote expires in 4:32". When it expires the confirm button becomes "Get a new quote". Buttons "Edit" (back to step 1 with the draft intact) and "Confirm transfer" (third parties continue to step 3).
- **Step 3, "Enter your verification code":** 6-digit input with "Demo code: 123456". Wrong code shows "Incorrect code. 2 attempts left."; the third failure shows "Too many attempts. Start a new transfer." and returns to step 1.
- **Step 4, "Transfer sent":** reference, date and time in the bank's time zone and the full detail, with "Make another transfer" and "View transactions".
- **Busy and error states:** action buttons are disabled while their request runs. A network failure on confirm shows "We couldn't confirm your transfer. Check your transactions before trying again."; retrying reuses the same idempotency key.
- **Hidden balances:** mask the balances shown for source accounts. The amount being sent and received is always shown, because the user typed it and must verify it.
- **Reload:** the flow restarts at step 1 with an empty form; no half-confirmed transfer is restored.

## Deferred findings closed in this stage

| From v0.4.0 | Change |
| --- | --- |
| M1 | An account id in the URL that is not one of the user's accounts is ignored once accounts have loaded |
| M2 | "Export CSV" uses the text currently in the search box, even within the 300 ms debounce |
| M4 | "Clear filters" in the filter bar is shown only when a filter is active |
| Lockfile | `package-lock.json` root version follows `package.json` |

M3 (balance preference persisted in the handler), M5 (table at every width) and M6 (redundant `aria-busy` on the export button) stay deferred.

## Testing

| Area | Cases |
| --- | --- |
| `money.ts` | Parsing "1,500.50", spaces, 0, negatives, 3 decimals, text; both conversion directions; rounding down to the cent |
| `transferRules.ts` | Each business rule; RD$100,000.00 passes and RD$100,000.01 fails; daily limit counts USD at the reference rate and resets at midnight in Santo Domingo; holder name masking |
| Mock API | Lookup cases; quote shape and errors; confirm moves balances and appends transactions; same idempotency key returns the same receipt once; expired and used quotes; wrong code and lockout; beneficiary saved once |
| Transfers page | Own-account transfer end to end; third-party transfer with code; new account saved as beneficiary; USD to DOP with the applied rate; quote expiry and "Get a new quote"; edit keeps the draft; double click sends one request; network failure retry uses the same key; dashboard and history show the new transfer; hidden balances; focus moves between steps |
| Navigation | "Transfers" link and active state; dashboard "New transfer" button |
| Deferred findings | One test per row of the table above |

Every task ends with `npm test`, `npm run lint`, `npm run build` and `git status` before its commit.

## Delivery

- Branch: `feature/transfers`
- Pull request into `main`, then tag `v0.5.0`
