import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, paymentMode, emailMode } from './config.js';
import { q } from './db.js';
import { requireUser, requireAdmin, setSession, clearSession, hashPassword, verifyPassword } from './security.js';
import { sendEmail, emailLayout } from './mail.js';
import { LICENSES, fulfilOrder, getOrder } from './orders.js';
import { startPayment, verifyPaystack, isValidWebhook } from './payments.js';
import { escapeHtml, formatMoney, moneyToPesewas, randomToken, slugify, str, isEmail, wrap } from './util.js';
import { uploadBeat, uploadVideo, storedPath, removeFiles, removeStored, mediaUrl } from './uploads.js';

// ── DTOs ────────────────────────────────────────────────────────────────────────
const beatDto = (b, admin = false) => ({
  id: b.id,
  slug: b.slug,
  title: b.title,
  genre: b.genre,
  mood: b.mood,
  bpm: b.bpm,
  key: b.musical_key,
  tags: b.tags ? b.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
  description: b.description,
  prices: { mp3: b.price_mp3, wav: b.price_wav, exclusive: b.price_exclusive },
  coverUrl: mediaUrl(b.cover_path),
  previewUrl: mediaUrl(b.preview_path),
  plays: b.plays,
  published: !!b.published,
  ...(admin ? { audioName: b.audio_name, audioSize: b.audio_size } : {}),
});

const videoDto = (v) => ({
  id: v.id,
  title: v.title,
  description: v.description,
  videoUrl: mediaUrl(v.file_path),
  coverUrl: mediaUrl(v.cover_path),
  youtubeUrl: v.youtube_url,
  published: !!v.published,
  views: v.views,
});

const orderDto = (o) => ({
  reference: o.reference,
  status: o.status,
  method: o.method,
  license: o.license,
  licenseLabel: LICENSES[o.license]?.label || o.license,
  amount: o.amount,
  currency: o.currency,
  amountLabel: formatMoney(o.amount, o.currency),
  createdAt: o.created_at,
  paidAt: o.paid_at,
  beat: { title: o.beat_title, slug: o.beat_slug, coverUrl: mediaUrl(o.cover_path) },
  downloadUrl: o.status === 'paid' ? `/api/download/${o.download_token}` : null,
  buyer: o.buyer_email ? { name: o.buyer_name, email: o.buyer_email } : undefined,
});

const paymentDetails = () => ({
  momo: config.momo.number ? config.momo : null,
  bank: config.bank.accountNumber ? config.bank : null,
});

/** The amount and currency Paystack charged must match the order exactly. */
const matchesOrder = (order, v) => v.success && v.amount === order.amount && v.currency === order.currency;

const flag = (v) => !(v === false || v === 'false' || v === '0' || v === 0 || v === 'off');

// ── Auth ─────────────────────────────────────────────────────────────────────────
export const authRouter = Router();

authRouter.post('/register', wrap(async (req, res) => {
  const name = str(req.body.name, 80);
  const email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!name) return res.status(400).json({ error: 'Please enter your name.' });
  if (!isEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (q.get('SELECT id FROM users WHERE email = ?', email)) {
    return res.status(409).json({ error: 'An account with this email already exists. Try logging in.' });
  }
  const r = q.run("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'artist')", name, email, hashPassword(password));
  const user = q.get('SELECT * FROM users WHERE id = ?', r.lastInsertRowid);
  setSession(res, user.id);
  await sendEmail({
    to: email,
    subject: `Welcome to ${config.siteName}`,
    text: `Hi ${name}, welcome to ${config.siteName}! Browse the beats and your files will be emailed to you after purchase.\n${config.siteUrl}/#/beats`,
    html: emailLayout({
      title: `Welcome, ${name}!`,
      bodyHtml: '<p>Your account is ready. Buy a licence with Mobile Money or bank transfer, and your files arrive by email. You can message the producer any time from your dashboard.</p>',
      buttonText: 'Browse beats',
      buttonUrl: `${config.siteUrl}/#/beats`,
    }),
  });
  res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

authRouter.post('/login', wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = q.get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  setSession(res, user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}));

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user || null });
});

// ── Catalogue ────────────────────────────────────────────────────────────────────
export const catalogueRouter = Router();
const SORTS = {
  new: 'created_at DESC, id DESC',
  popular: 'plays DESC, id DESC',
  price_asc: 'price_mp3 ASC',
  price_desc: 'price_mp3 DESC',
  bpm: 'bpm ASC',
};

catalogueRouter.get('/beats', wrap(async (req, res) => {
  const search = str(req.query.q, 100);
  const genre = str(req.query.genre, 60);
  const sort = SORTS[req.query.sort] ? req.query.sort : 'new';
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = 12;
  const where = ['published = 1'];
  const params = [];
  if (search) {
    where.push('(title LIKE ? OR tags LIKE ? OR genre LIKE ? OR mood LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (genre) {
    where.push('genre = ?');
    params.push(genre);
  }
  const whereSql = where.join(' AND ');
  const total = q.get(`SELECT COUNT(*) AS n FROM beats WHERE ${whereSql}`, ...params).n;
  const rows = q.all(`SELECT * FROM beats WHERE ${whereSql} ORDER BY ${SORTS[sort]} LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
  const genres = q.all("SELECT DISTINCT genre FROM beats WHERE published = 1 AND genre <> '' ORDER BY genre").map((r) => r.genre);
  res.json({ items: rows.map((r) => beatDto(r)), total, page, pages: Math.max(1, Math.ceil(total / limit)), genres });
}));

catalogueRouter.get('/beats/:slug', wrap(async (req, res) => {
  const row = q.get('SELECT * FROM beats WHERE slug = ? AND published = 1', req.params.slug);
  if (!row) return res.status(404).json({ error: 'Beat not found.' });
  const related = q.all('SELECT * FROM beats WHERE published = 1 AND id <> ? AND genre = ? ORDER BY plays DESC LIMIT 4', row.id, row.genre);
  res.json({ beat: beatDto(row), related: related.map((r) => beatDto(r)) });
}));

catalogueRouter.post('/beats/:slug/play', wrap(async (req, res) => {
  q.run('UPDATE beats SET plays = plays + 1 WHERE slug = ? AND published = 1', req.params.slug);
  res.json({ ok: true });
}));

catalogueRouter.get('/videos', wrap(async (req, res) => {
  res.json({ items: q.all('SELECT * FROM videos WHERE published = 1 ORDER BY created_at DESC, id DESC').map(videoDto) });
}));

catalogueRouter.post('/videos/:id/view', wrap(async (req, res) => {
  q.run('UPDATE videos SET views = views + 1 WHERE id = ? AND published = 1', req.params.id);
  res.json({ ok: true });
}));

// ── Orders & payments ───────────────────────────────────────────────────────────
export const ordersRouter = Router();

ordersRouter.post('/', requireUser, wrap(async (req, res) => {
  const license = str(req.body.license, 20);
  if (!LICENSES[license]) return res.status(400).json({ error: 'Choose a licence.' });
  const beat = q.get('SELECT * FROM beats WHERE slug = ? AND published = 1', str(req.body.beat, 100));
  if (!beat) return res.status(404).json({ error: 'This beat is not available.' });

  const amount = beat[LICENSES[license].priceField];
  const reference = `BS-${Date.now().toString(36).toUpperCase()}-${randomToken(3).toUpperCase()}`;
  q.run(
    'INSERT INTO orders (reference, user_id, beat_id, license, amount, currency, download_token) VALUES (?, ?, ?, ?, ?, ?, ?)',
    reference, req.user.id, beat.id, license, amount, config.currency, randomToken(24),
  );
  let payment;
  try {
    payment = await startPayment({ reference, amountPesewas: amount, email: req.user.email });
  } catch (err) {
    q.run('DELETE FROM orders WHERE reference = ?', reference);
    console.error('[payments]', err.message);
    return res.status(502).json({ error: 'Payment could not be started. Please try again.' });
  }
  res.status(201).json({ reference, mode: payment.mode, checkoutUrl: payment.url, amountLabel: formatMoney(amount, config.currency) });
}));

ordersRouter.get('/mine', requireUser, wrap(async (req, res) => {
  const rows = q.all(
    `SELECT o.*, b.title AS beat_title, b.slug AS beat_slug, b.cover_path, b.audio_path, b.audio_name, b.audio_size,
            u.email AS buyer_email, u.name AS buyer_name
     FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id
     WHERE o.user_id = ? ORDER BY o.created_at DESC, o.id DESC`,
    req.user.id,
  );
  res.json({ items: rows.map(orderDto) });
}));

ordersRouter.get('/:reference', requireUser, wrap(async (req, res) => {
  const order = getOrder(req.params.reference);
  if (!order || (order.user_id !== req.user.id && req.user.role !== 'admin')) return res.status(404).json({ error: 'Order not found.' });
  res.json({ order: orderDto(order), paymentMode: paymentMode(), paymentDetails: paymentDetails() });
}));

/** Test mode only: simulates a Mobile Money or bank payment. */
ordersRouter.post('/:reference/test-pay', requireUser, wrap(async (req, res) => {
  if (paymentMode() !== 'test') return res.status(400).json({ error: 'Test payments are disabled.' });
  const order = getOrder(req.params.reference);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  const method = req.body.method === 'bank' ? 'bank' : 'mobile_money';
  const paid = await fulfilOrder(order.reference, `test-${method}`);
  res.json({ order: orderDto(paid) });
}));

/** Asks Paystack whether a pending order was paid. */
ordersRouter.post('/:reference/verify', requireUser, wrap(async (req, res) => {
  const order = getOrder(req.params.reference);
  if (!order || order.user_id !== req.user.id) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'paid' && paymentMode() === 'paystack') {
    const v = await verifyPaystack(order.reference).catch(() => null);
    if (v && matchesOrder(order, v)) {
      return res.json({ order: orderDto(await fulfilOrder(order.reference, `paystack-${v.channel || 'checkout'}`)) });
    }
  }
  res.json({ order: orderDto(order), paymentMode: paymentMode(), paymentDetails: paymentDetails() });
}));

/** Paystack returns the buyer here after checkout. Verify, deliver, then show the dashboard. */
export const callbackRouter = Router();
callbackRouter.get('/callback', wrap(async (req, res) => {
  const reference = str(req.query.reference || req.query.trxref, 100);
  const order = reference ? getOrder(reference) : null;
  if (order && order.status !== 'paid' && paymentMode() === 'paystack') {
    const v = await verifyPaystack(reference).catch(() => null);
    if (v && matchesOrder(order, v)) await fulfilOrder(reference, `paystack-${v.channel || 'checkout'}`);
  }
  res.redirect(`/#/dashboard${reference ? `?order=${encodeURIComponent(reference)}` : ''}`);
}));

/** Paystack webhook: the reliable confirmation, even if the buyer closes the tab. */
export const webhookRouter = Router();
webhookRouter.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), wrap(async (req, res) => {
  if (!isValidWebhook(req.body, req.get('x-paystack-signature'))) return res.status(401).end();
  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).end();
  }
  if (event.event === 'charge.success' && event.data?.reference) {
    const order = getOrder(event.data.reference);
    if (order && order.status !== 'paid') {
      const v = await verifyPaystack(order.reference).catch(() => null);
      if (v && matchesOrder(order, v)) await fulfilOrder(order.reference, `paystack-${v.channel || 'webhook'}`);
    }
  }
  res.status(200).end();
}));

// ── Downloads (works from the emailed link, no login needed) ─────────────────────
export const downloadRouter = Router();
downloadRouter.get('/:token', wrap(async (req, res) => {
  const row = q.get(
    'SELECT o.status, o.license, b.slug, b.audio_path, b.audio_name FROM orders o JOIN beats b ON b.id = o.beat_id WHERE o.download_token = ?',
    req.params.token,
  );
  if (!row) return res.status(404).send('Download link not found.');
  if (row.status !== 'paid') return res.status(402).send('This order has not been paid yet.');
  const file = path.join(config.dataDir, 'private', row.audio_path);
  if (!fs.existsSync(file)) return res.status(404).send('File not found. Please contact the producer.');
  res.download(file, `${row.slug}-${row.license}${path.extname(row.audio_name) || '.wav'}`);
}));

// ── Messages ─────────────────────────────────────────────────────────────────────
export const messagesRouter = Router();
const threadFor = (userId) => q.all('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at, id', userId);

messagesRouter.get('/', requireUser, wrap(async (req, res) => {
  q.run("UPDATE messages SET read = 1 WHERE user_id = ? AND sender = 'producer'", req.user.id);
  res.json({ items: threadFor(req.user.id) });
}));

messagesRouter.post('/', requireUser, wrap(async (req, res) => {
  const body = str(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Write a message first.' });
  q.run("INSERT INTO messages (user_id, sender, body) VALUES (?, 'artist', ?)", req.user.id, body);
  if (config.adminEmail) {
    await sendEmail({
      to: config.adminEmail,
      subject: `New message from ${req.user.name}`,
      text: `${req.user.name} (${req.user.email}) wrote:\n\n${body}\n\nReply on the site: ${config.siteUrl}/#/admin/messages/${req.user.id}`,
      html: emailLayout({
        title: `New message from ${req.user.name}`,
        bodyHtml: `<p style="white-space:pre-wrap;background:#f1f5f9;border-radius:10px;padding:14px">${escapeHtml(body)}</p>`,
        buttonText: 'Reply on the site',
        buttonUrl: `${config.siteUrl}/#/admin/messages/${req.user.id}`,
      }),
    });
  }
  res.status(201).json({ items: threadFor(req.user.id) });
}));

// ── Producer (admin) ──────────────────────────────────────────────────────────────
export const adminRouter = Router();
adminRouter.use(requireAdmin);

function parseBeat(body) {
  const title = str(body.title, 120);
  if (!title) return { error: 'Give the beat a title.' };
  const prices = {
    price_mp3: moneyToPesewas(body.price_mp3),
    price_wav: moneyToPesewas(body.price_wav),
    price_exclusive: moneyToPesewas(body.price_exclusive),
  };
  for (const [field, value] of Object.entries(prices)) {
    if (!value) return { error: `Enter a valid price (GHS) for ${field.replace('price_', '').toUpperCase()}.` };
  }
  const bpm = Number.parseInt(body.bpm, 10);
  return {
    data: {
      title,
      genre: str(body.genre, 60),
      mood: str(body.mood, 60),
      bpm: bpm > 0 && bpm < 400 ? bpm : null,
      musical_key: str(body.key, 30),
      tags: str(body.tags, 300),
      description: str(body.description, 2000),
      published: flag(body.published) ? 1 : 0,
      ...prices,
    },
  };
}

const uniqueSlug = (title, ignoreId = null) => {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; q.get('SELECT id FROM beats WHERE slug = ? AND id IS NOT ?', slug, ignoreId); n++) slug = `${base}-${n}`;
  return slug;
};

adminRouter.get('/stats', (req, res) => {
  const n = (sql) => q.get(sql).n || 0;
  res.json({
    revenue: n("SELECT COALESCE(SUM(amount), 0) AS n FROM orders WHERE status = 'paid'"),
    currency: config.currency,
    paidOrders: n("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'"),
    pendingOrders: n("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    artists: n("SELECT COUNT(*) AS n FROM users WHERE role = 'artist'"),
    beats: n('SELECT COUNT(*) AS n FROM beats'),
    videos: n('SELECT COUNT(*) AS n FROM videos'),
    plays: n('SELECT COALESCE(SUM(plays), 0) AS n FROM beats'),
    unreadMessages: n("SELECT COUNT(*) AS n FROM messages WHERE sender = 'artist' AND read = 0"),
  });
});

adminRouter.get('/settings', (req, res) => {
  res.json({
    siteUrl: config.siteUrl,
    currency: config.currency,
    paymentMode: paymentMode(),
    emailMode: emailMode(),
    adminEmail: config.adminEmail,
    paymentDetails: paymentDetails(),
    webhookUrl: `${config.siteUrl}/api/payments/webhook`,
  });
});

adminRouter.get('/beats', (req, res) => {
  res.json({ items: q.all('SELECT * FROM beats ORDER BY created_at DESC, id DESC').map((b) => beatDto(b, true)) });
});

adminRouter.post('/beats', uploadBeat, wrap(async (req, res) => {
  const files = req.files || {};
  const fail = (error) => {
    removeFiles(files);
    res.status(400).json({ error });
  };
  const { data, error } = parseBeat(req.body);
  if (error) return fail(error);
  if (!files.audio?.[0]) return fail('Upload the full beat (WAV or MP3).');
  if (!files.preview?.[0]) return fail('Upload a short preview for the player.');
  const audio = files.audio[0];
  const r = q.run(
    `INSERT INTO beats (slug, title, genre, mood, bpm, musical_key, tags, description, price_mp3, price_wav, price_exclusive,
       cover_path, preview_path, audio_path, audio_name, audio_size, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uniqueSlug(data.title), data.title, data.genre, data.mood, data.bpm, data.musical_key, data.tags, data.description,
    data.price_mp3, data.price_wav, data.price_exclusive,
    files.cover?.[0] ? storedPath(files.cover[0]) : null,
    storedPath(files.preview[0]), storedPath(audio), audio.originalname, audio.size, data.published,
  );
  res.status(201).json({ beat: beatDto(q.get('SELECT * FROM beats WHERE id = ?', r.lastInsertRowid), true) });
}));

adminRouter.put('/beats/:id', uploadBeat, wrap(async (req, res) => {
  const files = req.files || {};
  const current = q.get('SELECT * FROM beats WHERE id = ?', req.params.id);
  if (!current) {
    removeFiles(files);
    return res.status(404).json({ error: 'Beat not found.' });
  }
  const { data, error } = parseBeat(req.body);
  if (error) {
    removeFiles(files);
    return res.status(400).json({ error });
  }
  const next = { ...current, ...data };
  if (files.audio?.[0]) {
    next.audio_path = storedPath(files.audio[0]);
    next.audio_name = files.audio[0].originalname;
    next.audio_size = files.audio[0].size;
  }
  if (files.preview?.[0]) next.preview_path = storedPath(files.preview[0]);
  if (files.cover?.[0]) next.cover_path = storedPath(files.cover[0]);
  q.run(
    `UPDATE beats SET title = ?, genre = ?, mood = ?, bpm = ?, musical_key = ?, tags = ?, description = ?,
       price_mp3 = ?, price_wav = ?, price_exclusive = ?, published = ?,
       cover_path = ?, preview_path = ?, audio_path = ?, audio_name = ?, audio_size = ? WHERE id = ?`,
    next.title, next.genre, next.mood, next.bpm, next.musical_key, next.tags, next.description,
    next.price_mp3, next.price_wav, next.price_exclusive, next.published,
    next.cover_path, next.preview_path, next.audio_path, next.audio_name, next.audio_size, current.id,
  );
  if (files.audio?.[0]) removeStored(current.audio_path, { isPrivate: true });
  if (files.preview?.[0]) removeStored(current.preview_path);
  if (files.cover?.[0]) removeStored(current.cover_path);
  res.json({ beat: beatDto(q.get('SELECT * FROM beats WHERE id = ?', current.id), true) });
}));

adminRouter.delete('/beats/:id', wrap(async (req, res) => {
  const beat = q.get('SELECT * FROM beats WHERE id = ?', req.params.id);
  if (!beat) return res.status(404).json({ error: 'Beat not found.' });
  if (q.get('SELECT COUNT(*) AS n FROM orders WHERE beat_id = ?', beat.id).n > 0) {
    q.run('UPDATE beats SET published = 0 WHERE id = ?', beat.id);
    return res.json({ archived: true, message: 'This beat has sales, so it was hidden instead of deleted.' });
  }
  q.run('DELETE FROM beats WHERE id = ?', beat.id);
  removeStored(beat.audio_path, { isPrivate: true });
  removeStored(beat.preview_path);
  removeStored(beat.cover_path);
  res.json({ deleted: true });
}));

adminRouter.get('/videos', (req, res) => {
  res.json({ items: q.all('SELECT * FROM videos ORDER BY created_at DESC, id DESC').map(videoDto) });
});

adminRouter.post('/videos', uploadVideo, wrap(async (req, res) => {
  const files = req.files || {};
  const fail = (error) => {
    removeFiles(files);
    res.status(400).json({ error });
  };
  const title = str(req.body.title, 120);
  const link = str(req.body.youtube_url, 300);
  if (!title) return fail('Give the video a title.');
  if (!files.video?.[0] && !link) return fail('Upload a video file or paste a YouTube/Vimeo link.');
  if (link && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(link)) {
    return fail('The link must start with a YouTube or Vimeo address.');
  }
  const r = q.run(
    'INSERT INTO videos (title, description, file_path, cover_path, youtube_url, published) VALUES (?, ?, ?, ?, ?, ?)',
    title,
    str(req.body.description, 2000),
    files.video?.[0] ? storedPath(files.video[0]) : null,
    files.cover?.[0] ? storedPath(files.cover[0]) : null,
    link || null,
    flag(req.body.published) ? 1 : 0,
  );
  res.status(201).json({ video: videoDto(q.get('SELECT * FROM videos WHERE id = ?', r.lastInsertRowid)) });
}));

adminRouter.patch('/videos/:id', wrap(async (req, res) => {
  const v = q.get('SELECT * FROM videos WHERE id = ?', req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found.' });
  q.run('UPDATE videos SET published = ? WHERE id = ?', flag(req.body.published) ? 1 : 0, v.id);
  res.json({ video: videoDto(q.get('SELECT * FROM videos WHERE id = ?', v.id)) });
}));

adminRouter.delete('/videos/:id', wrap(async (req, res) => {
  const v = q.get('SELECT * FROM videos WHERE id = ?', req.params.id);
  if (!v) return res.status(404).json({ error: 'Video not found.' });
  q.run('DELETE FROM videos WHERE id = ?', v.id);
  removeStored(v.file_path);
  removeStored(v.cover_path);
  res.json({ deleted: true });
}));

adminRouter.get('/orders', wrap(async (req, res) => {
  const status = ['pending', 'paid'].includes(req.query.status) ? req.query.status : null;
  const rows = q.all(
    `SELECT o.reference, o.status, o.method, o.license, o.amount, o.currency, o.created_at, b.title AS beat_title,
            u.name AS buyer_name, u.email AS buyer_email
     FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id
     ${status ? 'WHERE o.status = ?' : ''} ORDER BY o.created_at DESC, o.id DESC LIMIT 300`,
    ...(status ? [status] : []),
  );
  res.json({
    items: rows.map((o) => ({
      reference: o.reference,
      status: o.status,
      method: o.method,
      license: o.license,
      amountLabel: formatMoney(o.amount, o.currency),
      beat: o.beat_title,
      buyer: { name: o.buyer_name, email: o.buyer_email },
      createdAt: o.created_at,
    })),
  });
}));

adminRouter.post('/orders/:reference/confirm', wrap(async (req, res) => {
  const order = getOrder(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const paid = await fulfilOrder(order.reference, 'manual');
  res.json({ ok: true, status: paid.status });
}));

adminRouter.get('/threads', (req, res) => {
  res.json({
    items: q.all(
      `SELECT u.id, u.name, u.email,
         (SELECT body FROM messages m WHERE m.user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_body,
         (SELECT MAX(created_at) FROM messages m WHERE m.user_id = u.id) AS last_at,
         (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.sender = 'artist' AND m.read = 0) AS unread
       FROM users u WHERE u.id IN (SELECT DISTINCT user_id FROM messages) ORDER BY last_at DESC`,
    ),
  });
});

adminRouter.get('/messages/:userId', wrap(async (req, res) => {
  const user = q.get("SELECT id, name, email FROM users WHERE id = ? AND role = 'artist'", req.params.userId);
  if (!user) return res.status(404).json({ error: 'Conversation not found.' });
  q.run("UPDATE messages SET read = 1 WHERE user_id = ? AND sender = 'artist'", user.id);
  res.json({ user, items: threadFor(user.id) });
}));

adminRouter.post('/messages/:userId', wrap(async (req, res) => {
  const user = q.get("SELECT id, name, email FROM users WHERE id = ? AND role = 'artist'", req.params.userId);
  if (!user) return res.status(404).json({ error: 'Conversation not found.' });
  const body = str(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Write a reply first.' });
  q.run("INSERT INTO messages (user_id, sender, body, read) VALUES (?, 'producer', ?, 0)", user.id, body);
  await sendEmail({
    to: user.email,
    subject: `New message from ${config.adminName}`,
    text: `${body}\n\nOpen your dashboard to reply: ${config.siteUrl}/#/dashboard`,
    html: emailLayout({
      title: 'You have a new message',
      bodyHtml: `<p style="white-space:pre-wrap;background:#f1f5f9;border-radius:10px;padding:14px">${escapeHtml(body)}</p>`,
      buttonText: 'Open my messages',
      buttonUrl: `${config.siteUrl}/#/dashboard`,
    }),
  });
  res.status(201).json({ user, items: threadFor(user.id) });
}));

adminRouter.get('/outbox', (req, res) => {
  res.json({ items: q.all('SELECT id, to_email, subject, status, error, created_at FROM outbox ORDER BY id DESC LIMIT 200') });
});

adminRouter.get('/outbox/:id', wrap(async (req, res) => {
  const email = q.get('SELECT * FROM outbox WHERE id = ?', req.params.id);
  if (!email) return res.status(404).json({ error: 'Email not found.' });
  res.json({ email });
}));
