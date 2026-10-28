# Altura Bank

[![CI](https://github.com/RamsesJM/altura-bank/actions/workflows/ci.yml/badge.svg)](https://github.com/RamsesJM/altura-bank/actions/workflows/ci.yml)

**[Live demo](https://altura-bank.vercel.app)** · sign in with the demo account below.

Online banking demo built with React and TypeScript. The goal is to reproduce the parts of a banking front end where details matter most: authentication, session security, account data, form validation and error handling, all backed by automated tests.

> Altura Bank is a fictional bank created for portfolio purposes.

## Try it

| Email | Password |
| --- | --- |
| `demo@alturabank.com` | `Demo1234` |

The login page also has a **Use demo account** button that fills both fields.

## Features

### Authentication

- Sign in against an HTTP API with client-side validation and clear error messages
- Remaining attempts shown after a wrong password
- Account locked for 60 seconds after 3 failed attempts, with a live countdown
- Error messages never reveal whether an email is registered

### Accounts dashboard

- Consolidated balance in Dominican pesos, converting USD accounts at the Banco Central reference rate
- Savings and checking accounts in DOP and USD with masked account numbers
- Five most recent transactions with credit and debit amounts
- Hide balances with one tap; the preference is remembered on the device
- Loading skeletons, empty states and per-section errors with a retry button, so one failing request never blanks the whole page

### Transaction history

- Full history with pagination, 10 transactions per page
- Filters by account, type (credits or debits) and date range, plus a text search that ignores case and accents
- Filters and page live in the URL, so a filtered view can be bookmarked, shared or restored with the back button
- Dates are filtered and shown in the bank's time zone (Santo Domingo), so a transaction never lands on the wrong day
- Export the filtered list to CSV with one click; cells that could run as spreadsheet formulas are neutralized
- Invalid dates or page numbers in the URL are ignored instead of breaking the page

### Transfers

- Transfers between your own accounts and to other customers of the bank
- Saved beneficiaries, or any account number: the holder's name is shown masked (for example "Maria P.") before you send
- DOP and USD conversion with separate buy and sell rates, shown before you confirm
- Review step with the exact amounts and a 5-minute quote; a one-time code for transfers to other people (demo code `123456`, 3 attempts)
- Limits for transfers to other people: RD$100,000 per transfer and RD$250,000 per day, counted in Santo Domingo time
- A double click, a retried request or a lost connection never sends the money twice
- Receipt with a reference number; balances, history and beneficiaries update right away

### Session security

- Protected routes: private pages redirect to the login and come back to the requested page after signing in
- Automatic sign-out after 5 minutes of inactivity, also enforced the moment a locked phone or background tab comes back, before any data is shown
- Touch, pen, mouse, keyboard and scrolling inside any element count as activity
- Warning dialog with a countdown 60 seconds before the session expires
- Active users stay signed in: the session is renewed in the background while they use the app
- Any expired session detected by the API signs the user out from a single place
- Cached account data is cleared on sign-out, so it is never shown to the next person using the browser

### Mobile

- Bottom navigation bar on phones, within thumb reach and clear of the iPhone home indicator
- 16 px form fields on phones, so iOS does not zoom in when a field is focused

### Installable app

- Install it from Chrome or Edge, or add it to the home screen on Android and iPhone, with its own icon and window
- No offline cache: account data is never stored on the device, and the only service worker is the mock API's
- Icons are drawn by a small Node script (`scripts/generate-icons.mjs`), so they can be rebuilt from code

### Quality

- 287 automated tests covering the mock API, the API client, routing, the login form, the session timeout, the dashboard, the transaction history and transfers
- Continuous integration: lint, tests and a production build run on GitHub Actions for every push and pull request, and `main` only accepts pull requests that pass
- Strict TypeScript, ESLint and Prettier
- Accessible forms: labels, `aria-invalid`, error announcements and keyboard-friendly dialogs

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Routing | React Router 7 |
| Server state | TanStack Query 5 |
| API | Mock Service Worker (MSW) |
| Tests | Vitest, React Testing Library, user-event, jsdom |
| Tooling | Vite 7, ESLint, Prettier |

## Why these choices

**React with TypeScript.** It is the most common stack for banking front ends I have seen in job descriptions. Strict typing catches mistakes in API responses and component props before the code runs, which matters when the data is money.

**A mocked API instead of a backend.** I wanted to focus on the front end while still writing it as if a real server existed. MSW intercepts real `fetch` calls, so the app sends HTTP requests, receives status codes like `401` or `423` and handles latency. Replacing it with a real API would not require changes in components or services. The same handlers are reused in the tests, so every test exercises the full request and response cycle.

**One API client for every request.** All calls go through `apiClient`, which converts every failure into an `ApiError` with a fixed shape. Screens never parse raw responses, and an expired session is handled in one place for the whole app.

**TanStack Query for server data.** Account balances and transactions are server state: they can change elsewhere and go stale. TanStack Query handles caching, loading and error states and retries, so components only describe what to show. Retries are limited to one and never happen on an expired session, and the whole cache is cleared on sign-out.

**Money in cents.** The consolidated balance converts each amount to cents before adding, so floating point errors never show up as a wrong cent on screen.

**Filtering on the server.** The history page sends its filters to the API and receives one page at a time, as it would with a real bank where an account can have thousands of transactions. The filtering, search and pagination logic lives in pure functions that the mock API uses and that are tested on their own.

**Quote first, then confirm.** A transfer moves money in two calls. The quote validates the balance, limits and destination and fixes the rate and amounts the customer sees; the confirmation only accepts that quote, checks everything again and carries an idempotency key, so repeating it returns the same receipt instead of a second debit. The browser never calculates the amount that is sent. All money math is done in whole cents and converted amounts are rounded down, so a rounding error can never create a cent.

**Tests first.** Each feature started with failing tests describing the expected behavior. Timer-based rules like the lockout and the inactivity timeout are tested with fake timers, so they run in seconds instead of minutes.

## Security note

The session token is stored in `sessionStorage` so it is removed when the tab closes. In a production banking app the token would be issued by the server as an `httpOnly`, `Secure`, `SameSite=Strict` cookie, which JavaScript cannot read. That is not possible without a real backend, so this demo documents the trade-off instead of hiding it.

### One-time codes

The verification code is fixed and shown on screen because this demo has no SMS or email provider. A real bank would send a code that expires, is bound to the transfer and is checked only on the server, which is how the mock API treats it apart from the fixed value.

### CSV export

Exported files are opened in spreadsheet programs, which run any cell that starts with `=`, `+`, `-` or `@` as a formula. A transaction description is text the bank does not fully control, so every text cell that starts with one of those characters, a tab or a carriage return is prefixed with `'`. Amounts are written as plain numbers and keep their sign.

## Project structure

```
src/
├── components/   Reusable UI, layout, route guards, dashboard, transaction and transfer sections
├── config/       Demo account settings
├── context/      Authentication state
├── hooks/        Auth, session timeout, banking queries, URL filters and balance visibility
├── mocks/        Mock API (MSW handlers and in-memory data)
├── pages/        Login, dashboard, transaction history and transfers
├── routes/       Route definitions
├── services/     API client, auth and banking services, query client
├── test/         Test setup and helpers
├── types/        Shared TypeScript types
└── utils/        Money and currency conversion, date formatting, balance calculation and file downloads
```

`scripts/generate-icons.mjs` draws the favicon and app icons into `public/`.

Design decisions are documented in [`docs/specs`](docs/specs).

## Getting started

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the code with Prettier |
| `npm run build` | Type-check and build for production |

## Roadmap

- [x] Project setup
- [x] Authentication and session management
- [x] Accounts dashboard
- [x] Transaction history with filters
- [x] Transfers
- [x] Continuous integration with GitHub Actions
- [x] Mobile support: touch activity detection, locked-device session handling and mobile-first polish
- [x] Deployment to Vercel with a live demo
- [x] Installable Progressive Web App

## Author

Developed by [ramsesj.dev](https://ramsesj.dev)
