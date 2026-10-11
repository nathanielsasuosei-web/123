# Beat Store

A storefront for a music producer. Beats and videos are uploaded from a private
producer dashboard. Artists create an account, buy a licence with **Mobile Money or
bank transfer** (GHS), and receive the beat **by email**. Purchase confirmations and
messages also go by email.

On top of that it ships an **animated hero**, a **dynamic glass navbar**, **smooth
log-in / sign-up animation**, and an **adjustable colour system**: one accent colour
drives the whole site, the producer can publish it for everyone, and any visitor can
re-tint their own screen from the colour dock.

## Quick start

Requires Node.js 22.13 or newer (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env        # then set ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET
npm run seed                # creates the producer account and 5 demo beats
npm start                   # http://localhost:4000
```

Log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` to reach the producer area at `#/admin`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Starts the server on `0.0.0.0:$PORT`. |
| `npm run dev` | Same, restarting on file changes. |
| `npm run seed` | Creates the producer account from `ADMIN_EMAIL` (or promotes it) and adds demo beats. Safe to re-run. |
| `npm run smoke` | End-to-end API test against a running server (set `SMOKE_URL` for a remote one). Covers sign-up, buying, delivery, messages, admin access and the site-look API. |
| `npm run check:ui` | Front-end harness: drives the real SPA modules in a DOM (set `BASE` for a remote server). Covers the hero, glass navbar, colour engine, auth animation and the full buy flow. Needs `npm install` (jsdom is a dev dependency). |

## Payments

- **Test mode** (default, when `PAYSTACK_SECRET_KEY` is empty): the buyer picks Mobile
  Money or bank transfer and confirms. No money moves. Use this to try the whole flow.
- **Live mode** (set `PAYSTACK_SECRET_KEY`): buyers are sent to Paystack Checkout, which
  accepts Mobile Money and bank payments in GHS. Orders are confirmed by the callback
  (`/payments/callback`), by the webhook (`POST /api/payments/webhook`, HMAC-SHA512
  signed), or by the producer under **Orders → Mark paid** for manual bank transfers.
  Add the webhook URL shown in **Settings** to your Paystack dashboard.

Each order is delivered exactly once, even if the buyer pays, refreshes, or the webhook
arrives twice. Amounts are checked against Paystack before an order is marked paid.

## Email

- Set `SMTP_HOST` (and the other `SMTP_*` values) to send real email.
- With no SMTP set, every email is still saved to the producer's **Mailbox**, so you can
  check what would have been sent.
- Beats up to `EMAIL_ATTACH_MAX_MB` are attached to the purchase email. Larger beats get
  a download link (valid while the order exists).

## Site look

**Adjustable colour.** One accent colour generates an 11-step ramp plus the light and
dark surfaces, gradients, glass tints, hero colours, favicon and email branding.

- **Visitors**: the colour dock (bottom-right) offers 8 presets, two colour pickers, a
  glass level and dark mode. Their choice is stored on their device only.
- **Producer**: `#/admin/settings` → **Site look** previews the same controls live and
  **Save look** publishes them to every visitor (`PUT /api/admin/theme`, stored in the
  `settings` table, served publicly at `GET /api/theme`). Saved looks also rebrand the
  emails — headers and buttons use the accent.
- **Defaults** come from `THEME_*` in `.env` until something is saved.

Palette generation lives in `server/theme.js` (emails) and `public/js/theme.js`
(screen); the two mirror each other so the admin preview is exactly what visitors get.
`public/css/styles.css` only reads custom properties, so nothing is hard-coded to blue.

**Dynamic glass navbar** (`public/js/navbar.js`): shrinks and thickens as you scroll,
carries a reading-progress line, hides on a fast scroll down and returns on a scroll up,
goes clear and light-on-dark while it sits over the hero, picks up a tint from the
content behind it, follows the cursor with a spotlight, and slides a pill between nav
links. On mobile the drawer is a glass sheet with staggered links and a morphing
hamburger. Glass strength is a setting (solid → frosted).

**Animated hero** (`public/js/home.js`): canvas waves, drifting dust and a glow painted
from the live accent (change the colour and the hero re-tints without a reload), pointer
parallax, a rotating headline, live catalogue stats and an equaliser strip. The producer
can switch it to a still frame (`heroMotion`), and `prefers-reduced-motion` is honoured
everywhere.

**Log in / sign up** (`public/js/auth.js`): one card morphs between the two modes (FLIP
height animation, sliding mode pill, staggered fields), floating labels, show/hide
password, a strength meter, and a submit button that runs idle → spinner → success.
Sign-up ends with confetti in the site colours; errors shake the card. A colour panel
sits behind the form on wide screens.

## Licences

| Licence | Price field | Notes |
| --- | --- | --- |
| MP3 Lease | `price_mp3` | Non-exclusive, MP3 delivered. |
| WAV Lease | `price_wav` | Non-exclusive, lossless WAV delivered. |
| Exclusive | `price_exclusive` | The beat is taken off sale after the purchase. |

Licence wording lives in `server/orders.js` (`LICENSES`).

## Files and storage

- `DATA_DIR` (default `./data`) holds `store.db` (SQLite), full beat files in
  `private/audio` (never served publicly), and previews, covers and videos in `public/`.
- Put `DATA_DIR` on a persistent disk in production, and back it up. Beat files are not
  in Git.

## Deploying

This is a long-running Node server with a local SQLite database and local file storage,
so host it on a server or VM (or a container with a persistent volume). It will not work
as a stateless serverless function, because the database and uploaded files need to
persist between requests.

Set `SITE_URL` to the public address, `AUTH_SECRET` to a long random string, and the
`ADMIN_*` values. Then run `npm run seed` once and `npm start`.

## Layout

```
server/   Express API, auth, payments, orders, email, uploads, theme, seed
public/   Single-page front end (vanilla JS modules), CSS, favicon
          js/ theme.js colour engine + dock · navbar.js glass navbar · auth.js login/signup
          js/ confetti.js celebration · home.js hero · core.js router/player/header
scripts/  smoke.js API end-to-end test · frontend-check.mjs front-end harness
```
