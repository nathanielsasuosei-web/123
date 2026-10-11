import express from 'express';
import path from 'node:path';
import { config, paymentMode, emailMode } from './config.js';
import { db, settings } from './db.js';
import { loadUser } from './security.js';
import { ensureProducer } from './seed.js';
import { getTheme, setTheme, themeFromEnv } from './theme.js';
import {
  authRouter, catalogueRouter, ordersRouter, callbackRouter, webhookRouter, downloadRouter, messagesRouter, adminRouter,
} from './routes.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Minimal cookie reader (no extra dependency).
app.use((req, _res, next) => {
  req.cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try {
      req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      req.cookies[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
  }
  next();
});

// The Paystack webhook needs the raw body, so it is mounted before express.json().
app.use('/api/payments', webhookRouter);
app.use('/payments', callbackRouter);

app.use(express.json({ limit: '100kb' }));
app.use(loadUser);

app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ ok: true, site: config.siteName, payments: paymentMode(), email: emailMode(), currency: config.currency });
});

/** The site look: the palette the browser turns into CSS custom properties. */
app.get('/api/theme', (req, res) => {
  res.json({ theme: getTheme() });
});

app.use('/api/auth', authRouter);
app.use('/api', catalogueRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/download', downloadRouter);
app.use('/api/admin', adminRouter);
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Covers, previews and videos. Full beat files live in data/private and are never served here.
app.use('/media', express.static(path.join(config.dataDir, 'public'), { maxAge: '7d', index: false }));
app.use('/media', (req, res) => res.status(404).end());

// Favicon in the site colours (?c=accent&d=accent2), so it follows the chosen theme.
app.get('/favicon.svg', (req, res) => {
  const hex = (v, fallback) => (/^[0-9a-f]{6}$/i.test(String(v || '')) ? `#${v}` : fallback);
  const a = hex(req.query.c, '#60a5fa');
  const b = hex(req.query.d, '#1d4ed8');
  res.type('image/svg+xml').set('Cache-Control', 'no-cache').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="64" height="64" rx="16" fill="url(#g)"/>
  <rect x="12" y="26" width="7" height="14" rx="3.5" fill="#fff"/>
  <rect x="23" y="18" width="7" height="30" rx="3.5" fill="#fff"/>
  <rect x="34" y="12" width="7" height="40" rx="3.5" fill="#fff"/>
  <rect x="45" y="22" width="7" height="20" rx="3.5" fill="#fff"/>
</svg>`);
});

// The website (single page app).
app.use(express.static(config.publicDir, { index: 'index.html' }));
app.get('*', (req, res) => res.sendFile(path.join(config.publicDir, 'index.html')));

app.use((err, req, res, _next) => {
  const userError = err.name === 'MulterError' || /not a supported|Unexpected upload/.test(err.message);
  if (!userError) console.error('[server]', err);
  const message =
    err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large (max 400 MB).' : userError ? err.message : 'Something went wrong. Please try again.';
  if (req.path.startsWith('/api')) return res.status(userError ? 400 : 500).json({ error: message });
  res.status(500).send(message);
});

ensureProducer();
// Environment defaults first, then whatever the producer saved in the dashboard.
themeFromEnv();
const storedTheme = settings.get('theme');
if (storedTheme) setTheme(storedTheme);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[store] ${config.siteName} running at http://localhost:${config.port}`);
  console.log(`[store] payments: ${paymentMode()} · email: ${emailMode()} · data: ${config.dataDir}`);
  console.log(`[store] theme: ${getTheme().presetName} ${getTheme().accent}`);
});
