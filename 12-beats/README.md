# 12 — Beat & Video Store

A storefront for a music producer, built with **Next.js 16** (App Router, React 19, Tailwind v4) and
**Postgres** — the same store as the Django build, but deployable on Vercel with no build tweaks.

- **Producer admin** (`/admin`): upload beats (audio, cover, price, BPM, key, genre), add videos
  (YouTube/Vimeo links or uploaded files), see every order, and read the outbox of emails the app sent.
- **Buyers**: create an account, browse and preview beats, pay, and get the files — by email and
  from `/dashboard`, with a personal download link (`/download/<token>`).
- **Payments**: Paystack with **mobile money + bank** channels. Every payment is verified
  server-side, the webhook signature is checked, and fulfilment happens **exactly once**.
- **Email**: receipt (with the beat attached when it is small enough) plus a "new sale" notice for
  the producer. With no email provider configured, messages are captured in Admin → Outbox.

## Run it locally

```bash
npm install
npm run dev            # http://localhost:3000
```

No configuration needed: the app starts an **embedded Postgres** in `.data/pglite`, seeds a demo
catalogue (six synthesised beats with artwork in `public/demo`), keeps uploads in `.data/uploads`,
runs checkout in **test mode**, and captures emails in the outbox.

### Become the producer

Any of these makes an account a producer (the only accounts that can open `/admin`):

```bash
# 1. Locally, against the embedded database (stop `npm run dev` first)
npm run producer:create -- you@example.com nathan "a-long-password"

# 2. Against any Postgres (also works for your production database)
DATABASE_URL="postgres://…" npm run producer:create -- you@example.com nathan "a-long-password"

# 3. Hosted, with no terminal: set PRODUCER_EMAIL + PRODUCER_PASSWORD and the app creates the
#    account itself on the first request (only while no producer exists yet).
```

## Deploy to Vercel

1. **Import the repository** at [vercel.com/new](https://vercel.com/new). Vercel detects Next.js
   automatically (this repo has `next` in `dependencies` and no extra build settings) — leave the
   framework preset, build command and output directory untouched.
2. **Add a Postgres database**: Project → Storage → *Create Database* → Neon (or Supabase, or any
   Postgres). Vercel injects `DATABASE_URL` for you. The schema is created on first use —
   `npm run db:init` is only a pre-flight check.
3. **Add Blob storage** (uploads): Project → Storage → Blob. This injects
   `BLOB_READ_WRITE_TOKEN`, which is what makes beat/cover/video uploads persist. Without it the
   deployment still works; the admin just asks for hosted media URLs instead of files.
4. **Set the environment variables** (Project → Settings → Environment Variables):

   | Variable | Why |
   | --- | --- |
   | `DATABASE_URL` | Accounts, catalogue, orders. Injected by the database integration. |
   | `AUTH_SECRET` | Signs session cookies — `openssl rand -base64 32`. |
   | `SITE_URL` | Absolute URL used in emails (`https://yourdomain.com`). |
   | `PAYSTACK_SECRET_KEY` | Turns on real payments. Leave empty for test checkout. |
   | `PAYMENT_CURRENCY` | `GHS`, `NGN`, `KES`, `ZAR`… must match your Paystack account. |
   | `PAYMENT_CHANNELS` | Defaults to `mobile_money,bank`. |
   | `RESEND_API_KEY`, `MAIL_FROM` | Delivers receipts. Without them, emails land in the outbox. |
   | `PRODUCER_EMAIL` | Where "new sale" notifications go (and the owner bootstrap, see above). |
   | `PRODUCER_PASSWORD` | Only for the first-run bootstrap; remove it after you log in. |
   | `BLOB_READ_WRITE_TOKEN` | Injected by the Blob integration. |

5. **Point the Paystack webhook** at `https://yourdomain.com/api/payments/webhook`
   (Paystack dashboard → Settings → API Keys & Webhooks).
6. Deploy, open `/api/health` to confirm what is wired up, log in, and open `/admin`.

### What works with what

| Piece | Not configured | Configured |
| --- | --- | --- |
| Database | Demo catalogue, read-only storefront | Accounts, orders, uploads, admin |
| Paystack | `/checkout/test/<reference>` simulates mobile-money/bank payment | Real Paystack redirect + verified webhook |
| Resend | Emails captured in Admin → Outbox | Receipt + beat attached, producer notified |
| Vercel Blob | Paste hosted media URLs | Upload files up to 200 MB (browser → Blob, past the 4.5 MB function limit) |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:init` | Create the schema in `DATABASE_URL` (idempotent) and print row counts |
| `npm run producer:create -- email username password` | Create or promote the producer account |
| `npm run smoke` | End-to-end test against a running server (see below) |
| `npm run media:demo` | Regenerate the demo beats and cover art (needs `numpy` + `lameenc`) |

### Smoke test

```bash
npm run dev                                     # terminal 1
npm run smoke                                   # terminal 2
SMOKE_PRODUCER_EMAIL=you@example.com SMOKE_PRODUCER_PASSWORD=… npm run smoke   # adds admin checks
```

It drives the app the way a browser with JavaScript disabled would: signup → buy → test checkout →
receipt → download (and, with producer credentials, login → all admin pages → publish a beat →
upload a file). Use `SMOKE_URL=https://your-deployment.vercel.app` to run it against a deployment.

## Project layout

```
app/
  page.tsx                 hero + latest beats/videos      app/actions/    server actions (auth, checkout, admin)
  beats/, videos/          catalogue and detail pages      app/api/        health, media, payments webhook, admin upload
  checkout/                test checkout, return, failed   app/download/   token download route
  dashboard/               buyer purchases                 app/admin/      producer area (overview, beats, videos, orders, outbox)
components/                header, cards, hero canvas, audio preview, admin forms
lib/
  config.ts                environment + integration status     data.ts      every query the app runs
  db.ts                    Postgres / embedded Postgres / demo   auth.ts      sessions, requireUser, requireProducer
  paystack.ts              initialize, verify, webhook signing   emails.ts    Resend or outbox
  fulfilment.ts            exactly-once "mark paid and deliver"  storage.ts   Vercel Blob or local disk
  password.ts              scrypt hashing (shared with scripts)  money.ts     decimal-safe amounts
db/schema.mjs              schema SQL, shared by the app and the scripts
scripts/                   db-init, create-producer, smoke, demo media generator
public/demo/               bundled demo beats + artwork
```

## Notes

- **Uploads in a serverless function are limited to ~4.5 MB**, so with Blob configured the browser
  uploads files directly to Blob (the admin does this for anything over 4 MB).
- **Media is served publicly** (previews must play for everyone). Uploads are random-keys under
  `beats/`, `covers/` and `videos/`; use a private bucket plus signed URLs if you need more control.
- Beats larger than `EMAIL_ATTACH_MAX_BYTES` (15 MB by default) are sent as a download link only.
- The demo media in `public/demo` is synthesised from scratch by `scripts/generate-demo-media.py` —
  no third-party audio is bundled.
