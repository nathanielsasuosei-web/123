# Beat Store

A storefront for a music producer. Beats and videos are uploaded from a private
producer dashboard. Artists create an account, buy a licence with **Mobile Money or
bank transfer** (GHS), and receive the beat **by email**. Purchase confirmations and
messages also go by email. Blue theme with an animated hero.

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
| `npm run smoke` | End-to-end test against a running server (set `SMOKE_URL` for a remote one). Covers sign-up, buying, delivery, messages and admin access. |

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
server/   Express API, auth, payments, orders, email, uploads, seed
public/   Single-page front end (vanilla JS modules), CSS, favicon
scripts/  smoke.js end-to-end test
```
