# Beat Store — a beat & video store for a music producer

A website where a producer sells beats and videos:

- **Producer (admin)** uploads beats (full file, preview, cover, prices, BPM, key, tags) and videos (file or YouTube/Vimeo link), confirms payments, replies to artists, and reads the mailbox of every email the store sent.
- **Artists** create an account, preview beats, pick a licence (MP3 lease, WAV lease, exclusive), pay with **Mobile Money** or **bank transfer**, and receive the beat **by email** and in their dashboard.
- **Messages** between artists and the producer live on the site, and every message also triggers an **email notification**.
- Animated **blue hero** on the home page, responsive layout, audio previews with a global player.

Stack: Node.js 22 + Express, SQLite (built-in `node:sqlite`), vanilla JavaScript front end (no build step), Paystack for payments, Nodemailer for SMTP email.

## Run it locally

Requires **Node.js 22.13 or newer**.

```bash
npm install
cp .env.example .env          # optional: edit the admin login and details
npm run seed                  # creates the producer account and 5 demo beats
npm start                     # http://localhost:4000
```

Then open http://localhost:4000. Log in as the producer (`ADMIN_EMAIL` / `ADMIN_PASSWORD`, default `producer@example.com` / `change-this-password`) and open **Producer** in the menu.

With no payment keys set, checkout runs in **test mode**: buyers see the Mobile Money number or bank details and confirm the payment themselves. No real money moves. Emails are kept in **Producer → Mailbox** until you configure SMTP.

### Smoke test

With the server running:

```bash
npm run smoke
```

It signs up an artist, buys a beat, pays, downloads, messages the producer, uploads a beat and a video as the producer, and checks that every email was recorded and delivered exactly once.

## Going live

### 1. Payments (Paystack: Mobile Money + bank transfer)

1. Create a Paystack account for Ghana and get your **secret key**.
2. Set `PAYSTACK_SECRET_KEY` and keep `PAYMENT_CURRENCY=GHS`.
3. In the Paystack dashboard, set the webhook URL to `https://YOUR-DOMAIN/api/payments/webhook`.

Buyers are sent to Paystack's hosted checkout, which offers Mobile Money and bank transfer. Each payment is verified with Paystack before the beat is delivered, and the webhook is signature-checked. Delivery happens once, even if the webhook and the buyer's return page both fire.

If a bank transfer arrives outside Paystack, use **Producer → Orders → Mark paid** to confirm it manually. That also emails the beat.

### 2. Email

Set the `SMTP_*` variables (for example from your domain's mail provider or Resend, Mailgun, or Gmail SMTP). Without SMTP, emails are only saved in the producer's mailbox.

Emails sent: welcome, purchase receipt with download link (the file is attached when it is under `EMAIL_ATTACH_MAX_MB`), new-sale notice to the producer, new-message notices in both directions.

### 3. Hosting

The app keeps its database and uploaded files on disk, so it needs a host with a **persistent disk** and a long-running Node process. Good options are Render, Railway, or Fly.io, with a disk mounted and `DATA_DIR` pointed at it. Serverless platforms such as Vercel will not keep uploads or the database between requests, so don't deploy this app there.

Set these in your host's environment settings (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `SITE_URL` | Public address of the site (used in emails and the payment callback) |
| `AUTH_SECRET` | Long random string that signs login sessions |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Producer account (created on first start) |
| `DATA_DIR` | Folder on the persistent disk for the database and uploads |
| `PAYSTACK_SECRET_KEY` | Turns on live payments |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Sends real email |
| `MOMO_NUMBER`, `MOMO_NAME`, `BANK_*` | Shown to buyers in test mode and for manual transfers |

## How the files are protected

- Full beats are stored in `data/private/` and are **never served directly**. They are only sent through a download link tied to a paid order (`/api/download/<token>`).
- Previews and cover art live in `data/public/` and are played on the site. Keep previews short or lower quality. The producer chooses the preview file when uploading.

## Project layout

```
server/
  index.js          Express app and routing
  config.js         environment settings
  db.js             SQLite schema
  auth.js           passwords (scrypt), signed session cookies
  payments.js       Paystack start / verify / webhook signature
  mailer.js         SMTP sending + the email outbox
  uploads.js        upload handling (audio, preview, cover, video)
  seed.js           producer account + demo beats (npm run seed)
  lib/              order fulfilment, licences, synthesizer for demo audio, helpers
  routes/           auth, catalogue, orders, account (downloads/messages), admin
public/
  index.html        single page app shell
  css/styles.css    blue theme, animated hero
  js/               router + pages (home, beats, videos, account, admin)
scripts/smoke.js    end-to-end test
```

## Known limits

- **Single server.** SQLite and local file storage suit one instance. To run several instances, move the database to Postgres and the files to object storage.
- **No password reset yet.** Artists can't reset a forgotten password. Add that before launch if you expect users to need it.
- **Replies are on the site.** Artists reply from their dashboard. Emails are notifications, not reply-by-email.
- **Licence terms** are sample text in `server/lib/licenses.js`. Replace them with your own legal wording.
