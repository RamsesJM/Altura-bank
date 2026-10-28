# Installable App

- **Status:** Approved
- **Date:** 2026-10-28
- **Version target:** v0.9.0

## Context

The live demo opens in a browser tab. Banking customers expect an app on their home screen, so this stage makes Altura Bank installable as a Progressive Web App. A site can have only one service worker per scope, and MSW's worker already controls `/`, so the stage adds no service worker of its own.

## Goals

- Install from Chrome, Edge and Android with the Altura Bank icon and name, opening in its own window.
- Add to Home Screen on iPhone with the right icon and title.
- The browser chrome takes the brand color.
- Icons are generated from code, so they can be rebuilt and carry no embedded metadata.

## Non-goals

- Offline mode or caching of pages or account data. Banks avoid keeping account data on the device; when there is no network the browser shows its own offline page.
- Push notifications, background sync, install prompts inside the app.

## Manifest (`public/manifest.webmanifest`)

| Field | Value |
| --- | --- |
| `name` | Altura Bank |
| `short_name` | Altura |
| `description` | Online banking demo built with React and TypeScript. |
| `id`, `start_url`, `scope` | `/` |
| `display` | `standalone` |
| `theme_color` | `#0f3d5e` (brand-700) |
| `background_color` | `#f8fafc` (page background, slate-50) |
| `icons` | `/icon-192.png` 192x192 any; `/icon-512.png` 512x512 any; `/icon-maskable-512.png` 512x512 maskable |

## Icons (`scripts/generate-icons.mjs`)

- A Node script with no dependencies draws the mark (the favicon path on a 32 x 32 grid) with 4 x 4 supersampling and encodes PNGs with `node:zlib`.
- Outputs to `public/`: `favicon.svg`; `icon-192.png` and `icon-512.png` (rounded square, transparent corners); `icon-maskable-512.png` and `apple-touch-icon.png` 180x180 (full square; the platform applies its own mask).
- PNGs contain only the IHDR, IDAT and IEND chunks.

## `index.html`

`<link rel="manifest" href="/manifest.webmanifest" />`, `<meta name="theme-color" content="#0f3d5e" />`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`, `<meta name="apple-mobile-web-app-title" content="Altura Bank" />`. The status bar style stays the default, so content never sits under the iPhone status bar.

## Testing

- `src/pwa.test.ts`: manifest fields; the three manifest icons and the Apple icon exist in `public/`; `index.html` has the four tags; `favicon.svg` has no `<metadata>` block and is under 400 characters.
- Manual on the deployed preview: Chrome or Edge on the PC shows the install button and the installed app opens in its own window with the icon; on the phone, install or Add to Home Screen shows the icon and the name, and the session rules still apply after locking the phone.

## Delivery

- Branch `feature/installable-app`, PR "Installable app", tag `v0.9.0`.
- README: an "Installable app" section, roadmap item checked, version 0.9.0.
