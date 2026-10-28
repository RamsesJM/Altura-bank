# Accounts Dashboard

- **Status:** Approved
- **Date:** 2026-10-27
- **Version target:** v0.3.0

## Context

After signing in, users land on a placeholder page. This stage replaces it with the main banking dashboard: consolidated balance, accounts and recent activity. It also introduces TanStack Query as the data layer that the transactions and transfers stages will build on.

## Goals

- Show every account with its masked number, currency and balance.
- Show a consolidated balance in Dominican pesos, converting USD at a reference rate.
- Show the five most recent transactions.
- Let users hide and show balances, remembering the choice.
- Handle loading, empty and error states per section.
- Never expose cached data from a previous session.

## Non-goals

- Full transaction history, filters and pagination (v0.4.0).
- Transfers and quick actions (v0.5.0).
- Live exchange rates.

## Currency change

The app moves from Bolivian bolivianos to Dominican pesos.

| Item | Before | After |
| --- | --- | --- |
| `Currency` type | `'BOB' \| 'USD'` | `'DOP' \| 'USD'` |
| `formatCurrency` | `es-BO` locale | `RD$` for DOP, `US$` for USD, two decimals, comma thousands separator |
| Login highlights and README | BOB | DOP |

## Approach

TanStack Query manages server state: caching, loading and error states, and retries. Each request goes through the existing `apiClient`, so error normalization and the global 401 handling keep working unchanged.

Query configuration:

| Setting | Value |
| --- | --- |
| `retry` | 1 attempt for network and server errors; never for `ApiError` with status 401 |
| `staleTime` | 30 seconds |
| `refetchOnWindowFocus` | `true` |

On sign-out, for any reason, the query cache is cleared before the login page renders.

## Architecture

```
src/
├── services/
│   ├── queryClient.ts            QueryClient factory with the settings above
│   └── bankingService.ts         getAccounts, getExchangeRate, getTransactions
├── hooks/
│   └── useBankingQueries.ts      useAccounts, useExchangeRate, useRecentTransactions
├── hooks/
│   └── useBalanceVisibility.ts   Hidden/visible state persisted in localStorage
├── utils/
│   └── balance.ts                totalBalanceInDop
├── components/dashboard/
│   ├── TotalBalanceCard.tsx
│   ├── AccountCard.tsx
│   ├── RecentTransactions.tsx
│   ├── BalanceToggle.tsx
│   ├── SectionError.tsx
│   └── Skeleton.tsx
└── pages/DashboardPage.tsx
```

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `bankingService` | Typed functions for banking endpoints | `apiClient` |
| `useBankingQueries` | Query keys and hooks per resource | `bankingService`, TanStack Query |
| `balance.ts` | Pure conversion and sum, rounded to 2 decimals | none |
| `useBalanceVisibility` | Read and persist the hide balances preference | `localStorage` |
| Dashboard components | Presentational; receive data and visibility via props | `format.ts` |

## API contract

All endpoints require a valid session and return `401 SESSION_EXPIRED` otherwise.

| Method | Endpoint | Success |
| --- | --- | --- |
| `GET` | `/api/accounts` | `200` `{ accounts: Account[] }` |
| `GET` | `/api/exchange-rate` | `200` `{ usdToDop: number, date: string }` |
| `GET` | `/api/transactions?limit=N` | `200` `{ transactions: Transaction[] }`, newest first; `limit` defaults to 20, max 50 |

```ts
type Currency = 'DOP' | 'USD';
type AccountType = 'savings' | 'checking';

interface Account {
  id: string;
  number: string;
  type: AccountType;
  currency: Currency;
  balance: number;
}

interface Transaction {
  id: string;
  accountId: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
}
```

`amount` is always positive; `type` carries the direction.

## Mock data

| Account | Number | Currency | Balance |
| --- | --- | --- | --- |
| Savings | `2004587214521` | DOP | 145,230.50 |
| Checking | `2004587219874` | DOP | 38,940.00 |
| Savings | `2004587213307` | USD | 2,350.75 |

- Exchange rate: `usdToDop` 60.83, date `2026-10-23` (Banco Central de la República Dominicana buy rate for that day, fixed for the demo).
- Around 30 transactions spread over the last 60 days across the three accounts, generated relative to the current date so the demo never looks stale. Descriptions are realistic and local: payroll, supermarket, electricity, transfers, card payments.

## UI

### Layout

- Existing top bar and greeting with last login stay; the balance toggle sits to the right of the greeting.
- **Total balance card:** brand background, label "Total balance", amount in DOP, footnote "USD converted at RD$60.83 · Reference rate Oct 23, 2026".
- **Accounts:** one card per account, three columns from the `md` breakpoint and a single column below. Each card shows "Savings account" or "Checking account", masked number, currency code and balance.
- **Recent transactions:** list with date, description, account (masked) and amount. Credits in green with `+`, debits in dark slate with `−`. Footer link "View all transactions", disabled until v0.4.0.

### States

| State | Behavior |
| --- | --- |
| Loading | Skeleton shapes matching each section |
| Error | Per section: "We couldn't load your accounts." (or transactions / exchange rate) and a "Try again" button that refetches only that section |
| Empty transactions | "No recent transactions." |
| Exchange rate failed | Accounts still render; total card shows the error state |
| Balances hidden | `RD$ ••••••` or `US$ ••••••` for every amount, including transactions |

### Accessibility

- Each section has an `h2`.
- Masked numbers have an accessible label "account ending in 4521".
- Transaction direction is conveyed in text ("Credit" / "Debit", visually hidden) and not only by color.
- The balance toggle uses `aria-pressed` and the label "Hide balances" / "Show balances".

## Testing

| Area | Cases |
| --- | --- |
| Mock API | Each endpoint with a valid session; 401 without one; transactions ordered newest first; `limit` respected and capped at 50 |
| `formatCurrency` | DOP as `RD$145,230.50`; USD as `US$2,350.75` |
| `balance.ts` | Mixed currencies converted and summed; rounding to 2 decimals; empty list returns 0 |
| Dashboard | Skeletons then data; correct total; masked numbers; hide and show balances persisted across reloads; section error with working "Try again"; one failing section does not affect the others |
| Security | After signing out and signing in again, no request result from the previous session is rendered from cache |

## Planned follow-ups

Agreed to be addressed in later stages, recorded here so they are not lost:

- **Mobile activity detection:** add `pointerdown` and `touchstart` to the inactivity events; touch devices have no `mousemove`.
- **Locked phone:** when the device wakes after the session deadline, sign out immediately instead of extending the session (review finding M1).
- **Mobile-first polish:** 44 px minimum touch targets, no hover-only interactions, `inputmode="email"`, amounts that never overflow on narrow screens, a test at mobile width.
- **Deployment to Vercel:** HTTPS is required for the MSW service worker on devices other than `localhost`; also provides the live demo link for the README.
- **Progressive Web App:** installable from the browser with icon and standalone display.

## Delivery

- Branch: `feature/accounts-dashboard`
- Commits, in order: currency change, mock banking API, query layer, dashboard sections, balance visibility, tests and docs
- Pull request into `main`, then tag `v0.3.0`
