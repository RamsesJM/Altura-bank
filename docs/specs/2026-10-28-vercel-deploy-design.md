# Live Demo on Vercel

- **Status:** Approved
- **Date:** 2026-10-28
- **Version target:** v0.8.0

## Context

Altura Bank can only be seen by cloning and installing it. A recruiter opens a live demo before reading code, so this stage publishes the app on Vercel. Two things break in a hosted build today: opening `/transactions` or `/transfers` directly (or reloading there) returns a 404, because the app uses client-side routing; and if the browser refuses to register the MSW service worker, the start-up promise rejects and the page stays blank.

## Goals

- A public URL that always shows the latest `main`, at no cost.
- Every route works when opened directly or reloaded.
- A visitor whose browser cannot start the mock API sees an explanation and a way to retry, never a blank page.
- Basic security headers suited to a banking front end.

## Non-goals

- Custom domain, analytics, a full Content Security Policy, social preview image.
- A real backend: the mock API keeps running in the browser.
- Forcing MSW's fallback mode when registration fails (it depends on MSW internals).

## Hosting

| Item | Value |
| --- | --- |
| Provider and plan | Vercel Hobby (free, personal and portfolio projects, no card) |
| Connection | Vercel GitHub integration on `RamsesJM/Altura-bank`; production branch `main` |
| Previews | Every pull request gets its own preview URL |
| Build | Vercel's Vite preset: `npm run build`, output `dist` (detected, no overrides) |
| Secrets | None; nothing is stored in the repository or in GitHub |

## Architecture

### `vercel.json`

- Rewrite `/(.*)` to `/index.html`. Vercel serves existing files first, so `assets/*`, `favicon.svg` and `mockServiceWorker.js` are unaffected.
- Headers on `/(.*)`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`.

### Start-up (`src/bootstrap.tsx`, `src/main.tsx`)

- `startApp(container, { startMocking, reload? }): Promise<Root>` creates the React root, awaits `startMocking()`, then renders `<App />` in `StrictMode`.
- If `startMocking()` rejects, it logs `console.error('[Altura Bank] The mock API could not start.', error)` and renders `<MockStartupError onRetry={reload} />`. `reload` defaults to `() => window.location.reload()`.
- `main.tsx` keeps `enableMocking()` and calls `startApp(document.getElementById('root')!, { startMocking: enableMocking })`.

### `MockStartupError` (`src/components/MockStartupError.tsx`)

Centered card on the page background with:
- `BrandLogo`.
- Heading (h1): "This demo couldn't start".
- Text: "Altura Bank runs a simulated banking server inside your browser, and this browser didn't allow it to start. Try again, or open the demo in Chrome, Edge, Safari or Firefox."
- Primary button "Try again" that calls `onRetry`.

## Testing

- `src/bootstrap.test.tsx`:
  - mocking starts → the login heading "Sign in to Altura Bank" appears;
  - mocking fails → heading "This demo couldn't start" appears and `console.error` was called once;
  - "Try again" → `reload` called once.
- Existing 280 tests keep passing.
- Manual on the deployed URL: sign in with the demo account; reload on `/transactions`; open `/transfers` in a new tab; response headers include the three values above; the demo works on a phone.

## Delivery

- Branch `feature/vercel-deploy`, PR "Live demo on Vercel", tag `v0.8.0`.
- README: "Live demo" link under the CI badge, roadmap item checked, version 0.8.0.
