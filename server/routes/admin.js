import { Router } from 'express';
import { config, paymentMode, emailMode } from '../config.js';
import { q } from '../db.js';
import { requireAdmin } from '../auth.js';
import { sendEmail, emailLayout } from '../mailer.js';
import { fulfilOrder, getOrder } from '../lib/orders.js';
import { escapeHtml, parseMoneyToPesewas, slugify, formatMoney } from '../lib/util.js';
import { wrap, str, toBeatDto, toVideoDto, paymentDetails } from '../lib/http.js';
import { uploadBeatFiles, uploadVideoFiles, storedPath, removeFiles, removeStored } from '../uploads.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

const flag = (v) => !(v === false || v === 'false' || v === '0' || v === 0 || v === 'off');

/** Validates the text fields of the beat form. Returns { data } or { error }. */
function parseBeatBody(body) {
  const title = str(body.title, 120);
  if (!title) return { error: 'Give the beat a title.' };
  const prices = {
    price_mp3: parseMoneyToPesewas(body.price_mp3),
    price_wav: parseMoneyToPesewas(body.price_wav),
    price_exclusive: parseMoneyToPesewas(body.price_exclusive),
  };
  for (const [field, value] of Object.entries(prices)) {
    if (!value) return { error: `Enter a valid price (GHS) for ${field.replace('price_', '').toUpperCase()}.` };
  }
  const bpmNumber = Number.parseInt(body.bpm, 10);
  return {
    data: {
      title,
      genre: str(body.genre, 60),
      mood: str(body.mood, 60),
      bpm: Number.isFinite(bpmNumber) && bpmNumber > 0 && bpmNumber < 400 ? bpmNumber : null,
      musical_key: str(body.key, 30),
      tags: str(body.tags, 300),
      description: str(body.description, 2000),
      published: flag(body.published) ? 1 : 0,
      ...prices,
    },
  };
}

function uniqueSlug(base, ignoreId = null) {
  let slug = slugify(base);
  let n = 2;
  while (q.get('SELECT id FROM beats WHERE slug = ? AND id IS NOT ?', slug, ignoreId)) {
    slug = `${slugify(base)}-${n++}`;
  }
  return slug;
}

// ── Overview ──────────────────────────────────────────────────────────────
adminRouter.get('/stats', wrap(async (req, res) => {
  const one = (sql) => q.get(sql).n || 0;
  res.json({
    revenue: q.get("SELECT COALESCE(SUM(amount), 0) AS n FROM orders WHERE status = 'paid'").n,
    currency: config.currency,
    paidOrders: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'paid'"),
    pendingOrders: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
    artists: one("SELECT COUNT(*) AS n FROM users WHERE role = 'artist'"),
    beats: one('SELECT COUNT(*) AS n FROM beats'),
    videos: one('SELECT COUNT(*) AS n FROM videos'),
    plays: one('SELECT COALESCE(SUM(plays), 0) AS n FROM beats'),
    unreadMessages: one("SELECT COUNT(*) AS n FROM messages WHERE sender = 'artist' AND read = 0"),
  });
}));

adminRouter.get('/settings', (req, res) => {
  res.json({
    siteName: config.siteName,
    siteUrl: config.siteUrl,
    currency: config.currency,
    paymentMode: paymentMode(),
    emailMode: emailMode(),
    adminEmail: config.adminEmail,
    paymentDetails: paymentDetails(),
    webhookUrl: `${config.siteUrl}/api/payments/webhook`,
  });
});

// ── Beats ─────────────────────────────────────────────────────────────────
adminRouter.get('/beats', wrap(async (req, res) => {
  const rows = q.all('SELECT * FROM beats ORDER BY created_at DESC, id DESC');
  res.json({ items: rows.map((r) => toBeatDto(r, { includeAdminFields: true })) });
}));

adminRouter.post('/beats', uploadBeatFiles, wrap(async (req, res) => {
  const files = req.files || {};
  const fail = (error) => {
    removeFiles(files);
    res.status(400).json({ error });
  };
  const { data, error } = parseBeatBody(req.body);
  if (error) return fail(error);
  if (!files.audio?.[0]) return fail('Upload the full beat (WAV or MP3).');
  if (!files.preview?.[0]) return fail('Upload a short preview file for the player.');

  const audio = files.audio[0];
  const result = q.run(
    `INSERT INTO beats (slug, title, genre, mood, bpm, musical_key, tags, description, price_mp3, price_wav, price_exclusive,
       cover_path, preview_path, audio_path, audio_name, audio_mime, audio_size, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    uniqueSlug(data.title),
    data.title,
    data.genre,
    data.mood,
    data.bpm,
    data.musical_key,
    data.tags,
    data.description,
    data.price_mp3,
    data.price_wav,
    data.price_exclusive,
    files.cover?.[0] ? storedPath(files.cover[0]) : null,
    storedPath(files.preview[0]),
    storedPath(audio),
    audio.originalname,
    audio.mimetype || 'application/octet-stream',
    audio.size,
    data.published,
  );
  const row = q.get('SELECT * FROM beats WHERE id = ?', result.lastInsertRowid);
  res.status(201).json({ beat: toBeatDto(row, { includeAdminFields: true }) });
}));

adminRouter.put('/beats/:id', uploadBeatFiles, wrap(async (req, res) => {
  const files = req.files || {};
  const current = q.get('SELECT * FROM beats WHERE id = ?', req.params.id);
  if (!current) {
    removeFiles(files);
    return res.status(404).json({ error: 'Beat not found.' });
  }
  const { data, error } = parseBeatBody(req.body);
  if (error) {
    removeFiles(files);
    return res.status(400).json({ error });
  }

  const next = { ...current, ...data };
  if (files.audio?.[0]) {
    next.audio_path = storedPath(files.audio[0]);
    next.audio_name = files.audio[0].originalname;
    next.audio_mime = files.audio[0].mimetype || 'application/octet-stream';
    next.audio_size = files.audio[0].size;
  }
  if (files.preview?.[0]) next.preview_path = storedPath(files.preview[0]);
  if (files.cover?.[0]) next.cover_path = storedPath(files.cover[0]);

  q.run(
    `UPDATE beats SET title = ?, genre = ?, mood = ?, bpm = ?, musical_key = ?, tags = ?, description = ?,
       price_mp3 = ?, price_wav = ?, price_exclusive = ?, published = ?,
       cover_path = ?, preview_path = ?, audio_path = ?, audio_name = ?, audio_mime = ?, audio_size = ?
     WHERE id = ?`,
    next.title, next.genre, next.mood, next.bpm, next.musical_key, next.tags, next.description,
    next.price_mp3, next.price_wav, next.price_exclusive, next.published,
    next.cover_path, next.preview_path, next.audio_path, next.audio_name, next.audio_mime, next.audio_size,
    current.id,
  );
  // Remove replaced files from disk.
  if (files.audio?.[0]) removeStored(current.audio_path, { private: true });
  if (files.preview?.[0]) removeStored(current.preview_path);
  if (files.cover?.[0]) removeStored(current.cover_path);

  const row = q.get('SELECT * FROM beats WHERE id = ?', current.id);
  res.json({ beat: toBeatDto(row, { includeAdminFields: true }) });
}));

adminRouter.delete('/beats/:id', wrap(async (req, res) => {
  const beat = q.get('SELECT * FROM beats WHERE id = ?', req.params.id);
  if (!beat) return res.status(404).json({ error: 'Beat not found.' });
  const orders = q.get('SELECT COUNT(*) AS n FROM orders WHERE beat_id = ?', beat.id).n;
  if (orders > 0) {
    // Buyers still need their files, so archive instead of deleting.
    q.run('UPDATE beats SET published = 0 WHERE id = ?', beat.id);
    return res.json({ archived: true, message: 'This beat has sales, so it was hidden from the store instead of deleted.' });
  }
  q.run('DELETE FROM beats WHERE id = ?', beat.id);
  removeStored(beat.audio_path, { private: true });
  removeStored(beat.preview_path);
  removeStored(beat.cover_path);
  res.json({ deleted: true });
}));

// ── Videos ────────────────────────────────────────────────────────────────
adminRouter.get('/videos', wrap(async (req, res) => {
  res.json({ items: q.all('SELECT * FROM videos ORDER BY created_at DESC, id DESC').map(toVideoDto) });
}));

adminRouter.post('/videos', uploadVideoFiles, wrap(async (req, res) => {
  const files = req.files || {};
  const fail = (error) => {
    removeFiles(files);
    res.status(400).json({ error });
  };
  const title = str(req.body.title, 120);
  const youtube = str(req.body.youtube_url, 300);
  if (!title) return fail('Give the video a title.');
  if (!files.video?.[0] && !youtube) return fail('Upload a video file or paste a YouTube/Vimeo link.');
  if (youtube && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)\//i.test(youtube)) {
    return fail('The video link must start with a YouTube or Vimeo address.');
  }
  const beatId = Number.parseInt(req.body.beat_id, 10) || null;
  if (beatId && !q.get('SELECT id FROM beats WHERE id = ?', beatId)) return fail('The linked beat does not exist.');

  const result = q.run(
    `INSERT INTO videos (title, description, file_path, cover_path, youtube_url, beat_id, published)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    title,
    str(req.body.description, 2000),
    files.video?.[0] ? storedPath(files.video[0]) : null,
    files.cover?.[0] ? storedPath(files.cover[0]) : null,
    youtube || null,
    beatId,
    flag(req.body.published) ? 1 : 0,
  );
  const row = q.get('SELECT * FROM videos WHERE id = ?', result.lastInsertRowid);
  res.status(201).json({ video: toVideoDto(row) });
}));

adminRouter.patch('/videos/:id', wrap(async (req, res) => {
  const row = q.get('SELECT * FROM videos WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Video not found.' });
  q.run('UPDATE videos SET published = ? WHERE id = ?', flag(req.body.published) ? 1 : 0, row.id);
  res.json({ video: toVideoDto(q.get('SELECT * FROM videos WHERE id = ?', row.id)) });
}));

adminRouter.delete('/videos/:id', wrap(async (req, res) => {
  const row = q.get('SELECT * FROM videos WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Video not found.' });
  q.run('DELETE FROM videos WHERE id = ?', row.id);
  removeStored(row.file_path);
  removeStored(row.cover_path);
  res.json({ deleted: true });
}));

// ── Orders ────────────────────────────────────────────────────────────────
adminRouter.get('/orders', wrap(async (req, res) => {
  const status = ['pending', 'paid'].includes(req.query.status) ? req.query.status : null;
  const rows = q.all(
    `SELECT o.reference, o.status, o.method, o.license, o.amount, o.currency, o.created_at, o.paid_at,
            b.title AS beat_title, u.name AS buyer_name, u.email AS buyer_email
     FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id
     ${status ? 'WHERE o.status = ?' : ''}
     ORDER BY o.created_at DESC, o.id DESC LIMIT 300`,
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
      paidAt: o.paid_at,
    })),
  });
}));

adminRouter.post('/orders/:reference/confirm', wrap(async (req, res) => {
  const order = getOrder(req.params.reference);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const paid = await fulfilOrder(order.reference, 'manual');
  res.json({ ok: true, status: paid.status });
}));

// ── Messages ──────────────────────────────────────────────────────────────
adminRouter.get('/threads', wrap(async (req, res) => {
  const rows = q.all(
    `SELECT u.id, u.name, u.email,
       (SELECT body FROM messages m WHERE m.user_id = u.id ORDER BY created_at DESC, id DESC LIMIT 1) AS last_body,
       (SELECT MAX(created_at) FROM messages m WHERE m.user_id = u.id) AS last_at,
       (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id AND m.sender = 'artist' AND m.read = 0) AS unread
     FROM users u
     WHERE u.id IN (SELECT DISTINCT user_id FROM messages)
     ORDER BY last_at DESC`,
  );
  res.json({ items: rows });
}));

adminRouter.get('/messages/:userId', wrap(async (req, res) => {
  const user = q.get("SELECT id, name, email FROM users WHERE id = ? AND role = 'artist'", req.params.userId);
  if (!user) return res.status(404).json({ error: 'Conversation not found.' });
  q.run("UPDATE messages SET read = 1 WHERE user_id = ? AND sender = 'artist'", user.id);
  const items = q.all('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at, id', user.id);
  res.json({ user, items });
}));

adminRouter.post('/messages/:userId', wrap(async (req, res) => {
  const user = q.get("SELECT id, name, email FROM users WHERE id = ? AND role = 'artist'", req.params.userId);
  if (!user) return res.status(404).json({ error: 'Conversation not found.' });
  const body = str(req.body.body, 2000);
  if (!body) return res.status(400).json({ error: 'Write a reply first.' });

  q.run("INSERT INTO messages (user_id, sender, body, read) VALUES (?, 'producer', ?, 0)", user.id, body);
  await sendEmail({
    to: user.email,
    subject: `New message from ${config.adminName || 'the producer'}`,
    text: `${body}\n\nOpen your dashboard to reply: ${config.siteUrl}/#/dashboard`,
    html: emailLayout({
      title: 'You have a new message',
      bodyHtml: `<p style="white-space:pre-wrap;background:#f1f5f9;border-radius:10px;padding:14px">${escapeHtml(body)}</p>`,
      buttonText: 'Open my messages',
      buttonUrl: `${config.siteUrl}/#/dashboard`,
    }),
  });
  const items = q.all('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at, id', user.id);
  res.status(201).json({ user, items });
}));

// ── Outbox (every email the store sent or recorded) ───────────────────────
adminRouter.get('/outbox', wrap(async (req, res) => {
  const rows = q.all('SELECT id, to_email, subject, text_body, html_body, status, error, created_at FROM outbox ORDER BY id DESC LIMIT 200');
  res.json({ items: rows });
}));

adminRouter.get('/outbox/:id', wrap(async (req, res) => {
  const row = q.get('SELECT * FROM outbox WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Email not found.' });
  res.json({ email: row });
}));

