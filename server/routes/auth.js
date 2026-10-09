import { Router } from 'express';
import { createSession, clearSession, hashPassword, verifyPassword } from '../auth.js';
import { q } from '../db.js';
import { sendEmail, emailLayout } from '../mailer.js';
import { config } from '../config.js';
import { escapeHtml } from '../lib/util.js';
import { wrap, str, isEmail, toUserDto } from '../lib/http.js';

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

  const result = q.run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'artist')",
    name,
    email,
    hashPassword(password),
  );
  const user = q.get('SELECT * FROM users WHERE id = ?', result.lastInsertRowid);
  createSession(res, user.id);

  await sendEmail({
    to: email,
    subject: `Welcome to ${config.siteName}`,
    text: `Hi ${name},\n\nWelcome to ${config.siteName}! Browse the beats, buy a licence and your files arrive by email.\n\n${config.siteUrl}/#/beats`,
    html: emailLayout({
      title: `Welcome, ${name}!`,
      bodyHtml: `<p>Your account is ready. Browse the catalogue, buy a licence with Mobile Money or bank transfer, and your files will be emailed to you.</p>
        <p>You can message the producer any time from your dashboard.</p>`,
      buttonText: 'Browse beats',
      buttonUrl: `${config.siteUrl}/#/beats`,
    }),
  });

  res.status(201).json({ user: toUserDto(user) });
}));

authRouter.post('/login', wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = q.get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: 'Wrong email or password.' });
  }
  createSession(res, user.id);
  res.json({ user: toUserDto(user) });
}));

authRouter.post('/logout', (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ? toUserDto(req.user) : null });
});
