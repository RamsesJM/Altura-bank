# Authentication and Session Management

- **Status:** Approved
- **Date:** 2026-10-27
- **Version target:** v0.2.0

## Context

Altura Bank is a front-end only online banking demo. There is no real backend, but the app must behave as if it talks to one: real HTTP requests, real status codes and server-side session rules. The login flow is the first thing a reviewer sees, so it has to be quick to try and robust under error conditions.

## Goals

- Sign in against an HTTP API with visible demo credentials.
- Protect every private route.
- Expire inactive sessions with a visible warning and countdown.
- Handle every API error in a single, predictable way.
- Cover the flow with automated tests.

## Non-goals

- User registration and password recovery.
- Multi-tab session synchronization.
- A real backend or database.

## Approach

[Mock Service Worker (MSW)](https://mswjs.io) intercepts `fetch` calls to `/api/*` and responds like a server would, including latency and error codes. Application code is unaware of the mock: removing MSW and pointing the API client to a real server requires no changes in components or services.

The same request handlers are reused in the test environment through `msw/node`, so tests exercise the full request/response cycle.

## Architecture

```
src/
├── mocks/
│   ├── browser.ts             MSW worker setup for development
│   ├── server.ts              MSW server setup for tests
│   ├── handlers.ts            /api/auth/* handlers
│   └── db.ts                  In-memory users, failed attempts and sessions
├── services/
│   ├── apiClient.ts           fetch wrapper, error normalization, 401 hook
│   └── authService.ts         login, logout, me, refresh
├── context/
│   └── AuthContext.tsx        Session state and actions
├── hooks/
│   └── useSessionTimeout.ts   Inactivity tracking and countdown
├── components/
│   ├── ProtectedRoute.tsx
│   └── SessionWarningModal.tsx
└── pages/
    ├── LoginPage.tsx
    └── DashboardPage.tsx      Placeholder until v0.3.0
```

Each unit has one responsibility:

| Unit | Responsibility | Depends on |
| --- | --- | --- |
| `apiClient` | Send requests, attach the session token, convert failures into `ApiError` | `fetch` |
| `authService` | Typed functions for each auth endpoint | `apiClient` |
| `AuthContext` | Hold the current user and session, expose `login`, `logout`, `refresh` | `authService` |
| `useSessionTimeout` | Track user activity, report remaining time | Browser events, timers |
| `ProtectedRoute` | Redirect unauthenticated users to `/login` | `AuthContext` |

## API contract

| Method | Endpoint | Success | Errors |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | `200` `{ user, session }` | `400` invalid payload, `401` invalid credentials, `423` account locked |
| `GET` | `/api/auth/me` | `200` `{ user, session }` | `401` missing or expired session |
| `POST` | `/api/auth/refresh` | `200` `{ session }` | `401` expired session |
| `POST` | `/api/auth/logout` | `204` | none |

```ts
interface User {
  id: string;
  fullName: string;
  email: string;
  lastLoginAt: string | null;
}

interface Session {
  token: string;
  expiresAt: string;
}
```

Error responses share one shape:

```ts
interface ApiErrorBody {
  code: 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'SESSION_EXPIRED' | 'VALIDATION_ERROR';
  message: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
}
```

The client adds `NETWORK_ERROR` and `UNKNOWN_ERROR` for failures that never reach the server or return unexpected responses.

## Business rules

| Rule | Value |
| --- | --- |
| Demo credentials | `demo@alturabank.com` / `Demo1234` |
| Failed attempts before lockout | 3 |
| Lockout duration | 60 seconds |
| Session lifetime without activity | 5 minutes |
| Warning shown before expiry | 60 seconds |
| Simulated latency | 400 to 800 ms |

The failed attempt counter resets after a successful login or when the lockout ends.

## User flows

### App start

1. `AuthContext` reads the token from `sessionStorage`.
2. If a token exists, it calls `GET /api/auth/me` while a full-screen loader is shown.
3. On success the user is authenticated; on `401` the token is cleared.

### Sign in

1. Client-side validation: email format and required password. Errors appear under each field and focus moves to the first invalid one.
2. On submit the button switches to "Signing in..." and is disabled.
3. On success the user is redirected to the route they originally requested, or `/` by default.
4. On failure an alert above the form shows:
   - `INVALID_CREDENTIALS`: "Incorrect email or password. N attempts remaining."
   - `ACCOUNT_LOCKED`: "Account temporarily locked. Try again in m:ss." with a live countdown; the submit button stays disabled until it ends.
   - `NETWORK_ERROR` or `UNKNOWN_ERROR`: "We couldn't connect. Please try again."
5. "Use demo account" fills both fields without submitting.

### Session timeout

1. `mousemove`, `keydown`, `click` and `scroll` reset the inactivity timer, throttled to once per second.
2. When 60 seconds remain, `SessionWarningModal` opens with a countdown. While it is open, activity does not reset the timer.
3. "Stay signed in" calls `POST /api/auth/refresh` and restarts the timer.
4. "Sign out" or reaching zero logs the user out and redirects to `/login` with "Your session has expired. Please sign in again." (the message only appears when the session expired, not on manual sign out).

### Unauthorized responses

Any `401` from an endpoint other than `/api/auth/login` triggers the `onUnauthorized` hook registered by `AuthContext`, which clears the session and redirects to `/login` with the expired message.

## UI

- **Login, desktop:** two columns, brand panel on the left and form on the right.
- **Login, mobile:** form only, brand mark above it.
- **Dashboard placeholder:** top bar with logo, user name and "Sign out"; greeting and "Last login" date.
- **Session modal:** native `<dialog>`, focus trapped, countdown in `m:ss`.

## Accessibility

- Every input has a visible label.
- Invalid fields use `aria-invalid` and `aria-describedby` pointing to their error message.
- The form alert uses `role="alert"`.
- The countdown in the session modal is announced with `aria-live="polite"` only at 60, 30 and 10 seconds to avoid noise.
- Password visibility toggle exposes its state with `aria-pressed`.

## Security notes

The session token is stored in `sessionStorage` so it is cleared when the tab closes. In a production banking app the token would be issued as an `httpOnly`, `Secure`, `SameSite=Strict` cookie so that JavaScript cannot read it. This trade-off is documented in the README.

Error messages never reveal whether an email exists in the system.

## Testing

Tools: Vitest, React Testing Library, `@testing-library/user-event`, `msw/node`, jsdom.

| Area | Cases |
| --- | --- |
| `apiClient` | Maps 401, 423, 500 and network failures to the right `ApiError`; calls `onUnauthorized` on 401 except for login |
| Login page | Field validation; wrong password shows attempts remaining; third failure locks the account; demo button fills fields; success redirects |
| `ProtectedRoute` | Redirects to `/login` without session; returns to the requested route after login |
| Session timeout | Warning at 4:00 of inactivity; logout at 5:00; activity resets the timer; "Stay signed in" extends the session |

Timer-based tests use fake timers.

## Delivery

- Branch: `feature/auth`
- Commits, in order: mock server, API client, auth context and routing, login page, session timeout, tests
- Pull request into `main`, then tag `v0.2.0`
