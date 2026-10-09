import crypto from 'node:crypto';
import { config } from './config.js';
import { q } from './db.js';

const COOKIE = 'bs_session';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

let secret = config.authSecret;
if (!secret) {
  // Random per-process secret: sessions reset on restart. Set AUTH_SECRET to keep them.
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[auth] AUTH_SECRET is not set; sessions will reset when the server restarts.');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

function sign(payload) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(res, userId) {
  const exp = Date.now() + MAX_AGE_MS;
  const payload = `${userId}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  res.cookie(COOKIE, token, {
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

function readUserId(req) {
  const raw = req.cookies?.[COOKIE];
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [uid, exp, sig] = parts;
  const expected = sign(`${uid}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(uid);
}

/** Loads req.user when a valid session cookie is present. Never rejects. */
export function loadUser(req, _res, next) {
  const uid = readUserId(req);
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
