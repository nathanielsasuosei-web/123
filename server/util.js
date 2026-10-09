import crypto from 'node:crypto';

export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString('hex');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Amounts are stored in pesewas (GHS 1 = 100). */
export const formatMoney = (pesewas, currency = 'GHS') => `${currency} ${(Number(pesewas) / 100).toFixed(2)}`;

export function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'beat'
  );
}

/** "45" or "45.5" → pesewas. Returns null when invalid. */
export function moneyToPesewas(value) {
  const n = Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return Math.round(n * 100);
}

export const str = (value, max = 500) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const isEmail = (value) =>
  typeof value === 'string' && value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/** Express 4 does not catch promise rejections, so async handlers are wrapped. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
