import crypto from 'node:crypto';

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Amounts are stored in pesewas (1 GHS = 100) so no float rounding happens. */
export function formatMoney(pesewas, currency = 'GHS') {
  const major = (Number(pesewas) / 100).toFixed(2);
  return `${currency} ${major}`;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'beat';
}

/** Parses a whole-number GHS input ("45", "45.5") into pesewas. Returns null when invalid. */
export function parseMoneyToPesewas(value) {
  const n = Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n < 0 || n > 100000) return null;
  return Math.round(n * 100);
}
