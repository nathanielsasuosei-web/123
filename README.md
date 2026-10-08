> **Two apps live in this repository**
>
> | App | Where | Stack | Deploying |
> | --- | --- | --- | --- |
> | MiraKilousE Beats (this README) | `server/` + `client/` | Express + Vite/React (npm workspaces) | Needs a Node host (Render, Railway, Fly…) — `npm run dev` locally |
> | **12 — Beat & Video Store** | `12-beats/` | Next.js 16 + Postgres | Vercel: set **Root Directory** to `12-beats`, framework is detected as Next.js. See `12-beats/README.md` |

# 🎧 MiraKilousE Beats — Type Beats Marketplace

A full-stack marketplace (inspired by **beatz.com** and **BeatStars**) where a music
producer sells beats and videos. Artists create an account, preview beats, pay with
**Mobile Money** or **bank transfer**, receive the purchased beat **by email** (with a
one-click download link), and can chat with the producer in a built-in **chat box**
(every message also triggers an email notification).

## ✨ Features

**For visitors**
- Browse/search beats by title, genre, mood, price — with sort & pagination
- Audio player with an interactive **waveform** (click to seek), plus a persistent bottom player with queue
- Beat detail pages with license selection (MP3 lease / WAV lease / Exclusive)
- Videos page with a lightbox player
- Contact form

**For artists**
- Register / log in (JWT auth)
- Checkout with **Mobile Money** (MTN / Vodafone / AirtelTigo) or **bank transfer**
- Order tracking (pending → paid), instant **download** of purchased beats
- Downloadable **license agreement** per order
- Dashboard: My orders · Downloads · Messages (chat box with the producer)
- Email notifications: welcome, order received, **payment confirmed + download link**, new chat message

**For the producer (admin)**
- Upload/edit/delete **beats** (audio + cover art, prices, BPM, key, tags)
- Upload/delete **videos** (optionally linked to a beat)
- Orders management: confirm payments manually, refunds, status filters
- Conversations view + chat box with every artist
- **Mailbox** tab: every email the system sends (demo mode) with full HTML preview
- Settings: site name, currency, MoMo number, bank details, license terms, demo-payment toggle
- Overview stats: revenue, orders, artists, plays, views

## 🚀 Quick start

```bash
npm install          # installs server + client (workspaces)
npm run seed         # creates the admin account + demo beats/videos (idempotent)
npm run dev          # starts API (http://localhost:4000) + website (http://localhost:5173)
```

Then open **http://localhost:5173**.

### Demo accounts

| Role   | Email                        | Password   |
| ------ | ---------------------------- | ---------- |
| Admin  | `admin@mirakilousbeats.com`  | `admin123` |
| Artist | create your own at /register | —          |

The seed script synthesizes **6 real WAV beats** (kick/snare/hats/bass/chords), renders
cover art, and encodes **2 real MP4 videos** — no external assets needed.

## 🧪 Try the purchase flow

1. Go to **/register** and create an artist account
2. Open any beat → choose a license → **Buy**
3. Pay with *Mobile Money* (enter a phone number) or *Bank transfer* (details shown at checkout)
4. In demo mode the payment auto-confirms after ~7 seconds (the admin can also confirm
   manually in **Admin → Orders**, and can turn auto-confirm off in **Admin → Settings**)
5. Your beat unlocks for download and a **download link is emailed** to you
   (see **Admin → Mailbox** in demo mode, or configure SMTP to send real email)
6. Chat with the producer from the beat page or your dashboard — both of you get an
   email notification per message

## 🛠 Tech stack

- **Server** (`server/`): Node.js + Express, SQLite (`node:sqlite`), JWT auth
  (roles: `admin` / `artist`), multer uploads, nodemailer (SMTP or demo outbox),
  simulated MoMo/bank payment confirmation
- **Client** (`client/`): React 18 + Vite + Tailwind CSS, React Router, Web Audio
  waveform player
- **Payments**: demo provider simulates approval; swap `server/src/payments.js`
  (`scheduleAutoConfirm`) with a real MTN MoMo / bank webhook to go live
- **Emails**: set `SMTP_*` in `server/.env` to send real email; otherwise every email
  is stored and viewable in the admin **Mailbox** tab

## 📁 Project structure

```
server/            Express API, SQLite DB, uploads, seed script (synthesizes demo media)
  src/routes/      auth, beats, videos, orders, messages, admin, misc
  src/payments.js  order creation, payment confirmation, emailed delivery
  seed.js          admin account + 6 synthesized beats + 2 encoded videos
client/            React SPA (Vite dev server proxies /api and /uploads to the server)
  src/pages/       Home, Beats, BeatDetail, Videos, Login, Register, Contact,
                   Dashboard (artist), Admin (producer)
  src/components/  Navbar, PlayerBar, BeatCard, Waveform, ChatBox, CheckoutModal…
```

## ⚙️ Configuration (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default 4000) |
| `JWT_SECRET` | session signing secret |
| `PUBLIC_URL` | base URL used in emailed links |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seeded admin account |
| `SMTP_HOST/PORT/USER/PASS/FROM` | real email delivery (empty = demo mailbox) |
| `PAYMENT_AUTO_CONFIRM` | `1` = demo payments auto-confirm; `0` = admin confirms manually |

## 🚢 Production build

```bash
npm run build        # builds client/dist
npm run server       # serves API + the built SPA from one server (port 4000)
```
