# Mobile Support

- **Status:** Approved
- **Date:** 2026-10-28
- **Version target:** v0.7.0

## Context

Altura Bank works on desktop, but three things break on a phone. The session timer is frozen while the phone is locked, and the first tap after unlocking counts as activity, so an expired session briefly comes back to life and shows balances until the server rejects it. Some touch gestures, such as scrolling inside the transactions table, do not count as activity. And at 375 px the header needs about 570 px, so it overflows, while the transaction filters use 14 px text, which makes iOS Safari zoom in on focus.

## Goals

- An expired session never shows account data again, including after the phone is locked or the app is in the background.
- Touch, pen and mouse input all count as activity, including scrolling inside an element.
- The main navigation fits and is easy to reach on a phone.
- Tapping a field does not zoom the page on iOS.

## Non-goals

- Shorter timeouts or hiding balances while the app is in the background (the 5-minute rule stays).
- Swipe gestures, pull to refresh, offline support or an installable app (PWA is its own stage).
- The blank page when the browser refuses the MSW service worker (deferred to the Vercel stage).
- Redesigning pages that already adapt to small screens (dashboard, filters, transfers, table columns).

## Session rules

| Rule | Value |
| --- | --- |
| Inactivity timeout | 5 minutes (unchanged) |
| Warning | 60 seconds before expiry (unchanged) |
| Background renewal | At most once per 60 seconds of activity (unchanged) |
| Returning to the app | If the deadline has passed, sign out at once, before any data is shown |
| Activity after the deadline | Signs out; never extends the session |
| Activity throttle | One handled event per second (unchanged) |

## Architecture

### `useSessionTimeout` (`src/hooks/useSessionTimeout.ts`)

- Activity events: `pointerdown`, `pointermove`, `keydown` on `window`, and `scroll` on `document` in the capture phase, so scrolls inside any element are seen. `mousemove` and `click` are removed because pointer events cover them.
- The deadline is also kept in a ref so event handlers read the current value without waiting for a render.
- New check `expireIfDue()`: if `Date.now() >= effective deadline` and the session has not expired yet, mark it expired and call `onExpire`. It returns whether it expired.
- `handleActivity` calls `expireIfDue()` first and returns if it expired, before the warning and throttle checks.
- On `visibilitychange` (when `document.visibilityState === 'visible'`) and on `pageshow`, the hook calls `expireIfDue()` and, if still alive, updates `now` so the countdown is correct at once.
- The public interface does not change: same options, same `{ remainingMs, isWarning, reset }`.

`SessionManager` needs no changes.

### Navigation (`src/components/AppLayout.tsx`)

- Below `sm` (640 px): the top header shows the logo and Sign out only. A bottom bar, `nav` with `aria-label="Main"`, holds the three links, each with an inline SVG icon and its label. It is fixed to the bottom, `min-h-16`, white with a top border, and pads its bottom with `env(safe-area-inset-bottom)`.
- From `sm` up: the current top navigation, unchanged. Only one of the two navigation landmarks is rendered visible at a time (the other is `hidden`), so screen readers find one "Main" navigation.
- The content area gets bottom padding below `sm` so the bar never covers the last element.
- The navigation items live in one array shared by both bars.
- `index.html` viewport becomes `width=device-width, initial-scale=1.0, viewport-fit=cover`.

### Inputs

Only the transaction filters (`fieldClass` in `src/components/transactions/TransactionFilters.tsx`) use 14 px text; they change to `text-base sm:text-sm`. The login, password, one-time code and transfer fields already use the 16 px default and stay as they are.

## Testing

- `useSessionTimeout`, fake timers:
  - hidden for 20 minutes with no ticks delivered, then `visibilitychange` to visible → `onExpire` called once, `onActivity` not called;
  - `pageshow` after the deadline → `onExpire` called once;
  - a `pointerdown` after the deadline, before any tick → `onExpire` called once, `onActivity` not called, deadline not extended;
  - back after 2 minutes → no expiry, `remainingMs` is 3 minutes;
  - `pointerDown` on `window` and a `scroll` on an inner element both restart the timer.
- `AppLayout`: both navigation bars render the links Dashboard, Transactions and Transfers in that order, and in each the current page link has `aria-current="page"`. (jsdom does not apply media queries, so both bars are in the test DOM; in a browser `display: none` keeps only one in the accessibility tree.)
- Existing 269 tests keep passing; `mousemove`/`click` based tests move to pointer events.
- Manual check on a real phone (iPhone Safari if available, Android Chrome or Edge): header and bottom bar at 360–430 px, no zoom on field focus, lock the phone for more than 5 minutes and confirm the login appears without a flash of balances.

## Delivery

- Branch `feature/mobile-support`, PR "Mobile support", tag `v0.7.0`.
- README: Session security bullets for the lock-screen rule and touch activity, a Mobile bullet under Quality or Features, roadmap item checked, version 0.7.0.
