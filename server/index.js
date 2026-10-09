import express from 'express';
import path from 'node:path';
import { config, paymentMode, emailMode } from './config.js';
import { db } from './db.js';
import { loadUser } from './security.js';
import { ensureProducer } from './seed.js';
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

app.listen(config.port, '0.0.0.0', () => {
  console.log(`[store] ${config.siteName} running at http://localhost:${config.port}`);
  console.log(`[store] payments: ${paymentMode()} · email: ${emailMode()} · data: ${config.dataDir}`);
});
