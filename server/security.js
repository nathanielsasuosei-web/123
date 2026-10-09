import crypto from 'node:crypto';
import { config } from './config.js';
import { q } from './db.js';

const COOKIE = 'bs_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let secret = config.authSecret;
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] AUTH_SECRET is not set; logins will reset when the server restarts.');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

const sign = (payload) => crypto.createHmac('sha256', secret).update(payload).digest('base64url');

export function setSession(res, userId) {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = `${userId}.${exp}`;
  res.cookie(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.siteUrl.startsWith('https://'),
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

function userIdFromCookie(req) {
  const raw = req.cookies?.[COOKIE];
  const parts = raw ? raw.split('.') : [];
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = sign(`${uid}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(uid);
}

export function loadUser(req, _res, next) {
  const uid = userIdFromCookie(req);
  req.user = uid ? q.get('SELECT id, name, email, role FROM users WHERE id = ?', uid) || null : null;
  next();
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please log in first.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Producer access only.' });
  next();
}
