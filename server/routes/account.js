import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { q } from '../db.js';
import { sendEmail, emailLayout } from '../mailer.js';
import { escapeHtml } from '../lib/util.js';
import { wrap, str } from '../lib/http.js';

/** Buyer downloads: /api/download/:token works from the email link, no login needed. */
export const downloadRouter = Router();
/** Messages between an artist and the producer. */
export const messagesRouter = Router();

downloadRouter.get('/:token', wrap(async (req, res) => {
  const row = q.get(
    `SELECT o.status, o.license, b.slug, b.audio_path, b.audio_name
     FROM orders o JOIN beats b ON b.id = o.beat_id WHERE o.download_token = ?`,
    req.params.token,
  );
  if (!row) return res.status(404).send('Download link not found.');
  if (row.status !== 'paid') return res.status(402).send('This order has not been paid yet.');

  const file = path.join(config.dataDir, 'private', row.audio_path);
  if (!fs.existsSync(file)) return res.status(404).send('File not found. Please contact the producer.');
  const ext = path.extname(row.audio_name) || '.wav';
  res.download(file, `${row.slug}-${row.license}${ext}`);
}));

messagesRouter.get('/', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  q.run("UPDATE messages SET read = 1 WHERE user_id = ? AND sender = 'producer'", req.user.id);
  const rows = q.all('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at, id', req.user.id);
  res.json({ items: rows });
}));

messagesRouter.post('/', wrap(async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
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
        bodyHtml: `<p style="white-space:pre-wrap;background:#f1f5f9;border-radius:10px;padding:14px">${escapeHtml(body)}</p>
          <p style="font-size:13px;color:#475569">${escapeHtml(req.user.email)}</p>`,
        buttonText: 'Reply on the site',
        buttonUrl: `${config.siteUrl}/#/admin/messages/${req.user.id}`,
      }),
    });
  }
  const items = q.all('SELECT id, sender, body, created_at FROM messages WHERE user_id = ? ORDER BY created_at, id', req.user.id);
  res.status(201).json({ items });
}));
