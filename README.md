# Altura Bank

Online banking demo built with React and TypeScript. The goal is to reproduce the parts of a banking front end where details matter most: authentication, session security, form validation and error handling, all backed by automated tests.

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

### Session security

- Protected routes: private pages redirect to the login and come back to the requested page after signing in
- Automatic sign-out after 5 minutes of inactivity
- Warning dialog with a countdown 60 seconds before the session expires
- Active users stay signed in: the session is renewed in the background while they use the app
- Any expired session detected by the API signs the user out from a single place

### Quality

- 58 automated tests covering the mock API, the API client, routing, the login form and the session timeout
- Strict TypeScript, ESLint and Prettier
- Accessible forms: labels, `aria-invalid`, error announcements and keyboard-friendly dialogs

## Tech stack

| Area | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 4 |
| Routing | React Router 7 |
| API | Mock Service Worker (MSW) |
| Tests | Vitest, React Testing Library, user-event, jsdom |
| Tooling | Vite 7, ESLint, Prettier |

## Why these choices

**React with TypeScript.** It is the most common stack for banking front ends I have seen in job descriptions. Strict typing catches mistakes in API responses and component props before the code runs, which matters when the data is money.

**A mocked API instead of a backend.** I wanted to focus on the front end while still writing it as if a real server existed. MSW intercepts real `fetch` calls, so the app sends HTTP requests, receives status codes like `401` or `423` and handles latency. Replacing it with a real API would not require changes in components or services. The same handlers are reused in the tests, so every test exercises the full request and response cycle.

**One API client for every request.** All calls go through `apiClient`, which converts every failure into an `ApiError` with a fixed shape. Screens never parse raw responses, and an expired session is handled in one place for the whole app.

**Tests first.** Each feature started with failing tests describing the expected behavior. Timer-based rules like the lockout and the inactivity timeout are tested with fake timers, so they run in seconds instead of minutes.

## Security note

The session token is stored in `sessionStorage` so it is removed when the tab closes. In a production banking app the token would be issued by the server as an `httpOnly`, `Secure`, `SameSite=Strict` cookie, which JavaScript cannot read. That is not possible without a real backend, so this demo documents the trade-off instead of hiding it.

## Project structure

```
src/
├── components/   Reusable UI and route guards
├── config/       Demo account settings
├── context/      Authentication state
├── hooks/        useAuth, useCountdown, useSessionTimeout
├── mocks/        Mock API (MSW handlers and in-memory data)
├── pages/        Login and dashboard
├── routes/       Route definitions
├── services/     API client, auth service, session storage
├── test/         Test setup and helpers
├── types/        Shared TypeScript types
└── utils/        Formatting helpers
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
- [ ] Accounts dashboard
- [ ] Transaction history with filters
- [ ] Transfers
- [ ] Continuous integration with GitHub Actions
- [ ] Loan simulator and deployment

## Author

Developed by [ramsesj.dev](https://ramsesj.dev)
