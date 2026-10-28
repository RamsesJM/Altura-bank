# Altura Bank

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

### Session security

- Protected routes: private pages redirect to the login and come back to the requested page after signing in
- Automatic sign-out after 5 minutes of inactivity
- Warning dialog with a countdown 60 seconds before the session expires
- Active users stay signed in: the session is renewed in the background while they use the app
- Any expired session detected by the API signs the user out from a single place
- Cached account data is cleared on sign-out, so it is never shown to the next person using the browser

### Quality

- 103 automated tests covering the mock API, the API client, routing, the login form, the session timeout and the dashboard
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

**Tests first.** Each feature started with failing tests describing the expected behavior. Timer-based rules like the lockout and the inactivity timeout are tested with fake timers, so they run in seconds instead of minutes.

## Security note

The session token is stored in `sessionStorage` so it is removed when the tab closes. In a production banking app the token would be issued by the server as an `httpOnly`, `Secure`, `SameSite=Strict` cookie, which JavaScript cannot read. That is not possible without a real backend, so this demo documents the trade-off instead of hiding it.

## Project structure

```
src/
├── components/   Reusable UI, route guards and dashboard sections
├── config/       Demo account settings
├── context/      Authentication state
├── hooks/        Auth, session timeout, banking queries and balance visibility
├── mocks/        Mock API (MSW handlers and in-memory data)
├── pages/        Login and dashboard
├── routes/       Route definitions
├── services/     API client, auth and banking services, query client
├── test/         Test setup and helpers
├── types/        Shared TypeScript types
└── utils/        Currency formatting and balance calculation
```

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
- [ ] Transaction history with filters
- [ ] Transfers
- [ ] Continuous integration with GitHub Actions
- [ ] Mobile support: touch activity detection, locked-device session handling and mobile-first polish
- [ ] Deployment to Vercel with a live demo
- [ ] Installable Progressive Web App
- [ ] Loan simulator

## Author

Developed by [ramsesj.dev](https://ramsesj.dev)
