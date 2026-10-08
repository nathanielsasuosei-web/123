import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(here, '..', 'data')
fs.mkdirSync(dataDir, { recursive: true })

const db = new DatabaseSync(path.join(dataDir, 'app.db'))
db.exec('PRAGMA journal_mode = WAL')

/** Minimal transaction helper (mirrors better-sqlite3's db.transaction) */
export function transaction(fn) {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'artist' CHECK (role IN ('admin','artist')),
  phone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS beats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  producer TEXT NOT NULL,
  genre TEXT,
  mood TEXT,
  bpm INTEGER,
  musical_key TEXT,
  description TEXT,
  tags TEXT,
  price_mp3 REAL NOT NULL DEFAULT 0,
  price_wav REAL NOT NULL DEFAULT 0,
  price_exclusive REAL NOT NULL DEFAULT 0,
  audio_file TEXT NOT NULL,
  cover_file TEXT,
  plays INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  beat_id INTEGER REFERENCES beats(id) ON DELETE SET NULL,
  video_file TEXT NOT NULL,
  thumbnail TEXT,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  beat_id INTEGER NOT NULL REFERENCES beats(id),
  license_type TEXT NOT NULL CHECK (license_type IN ('mp3','wav','exclusive')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GHS',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money','bank_transfer')),
  payer_phone TEXT,
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','cancelled')),
  download_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);

CREATE TABLE IF NOT EXISTS downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  beat_id INTEGER NOT NULL REFERENCES beats(id),
  license_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
`)

export const DEFAULT_SETTINGS = {
  site_name: 'MiraKilousE Beats',
  producer_name: 'MiraKilousE',
  currency_code: 'GHS',
  currency_symbol: '₵',
  momo_provider: 'MTN Mobile Money',
  momo_number: '024 400 0000',
  bank_name: 'Stanbic Bank',
  bank_account_name: 'MiraKilousE Studios',
  bank_account_number: '0000 1234 5678',
  contact_email: 'admin@mirakilousbeats.com',
  payment_auto_confirm: '1',
  license_terms:
    'This license grants the artist (licensee) a non-exclusive right to use the beat ' +
    'for one (1) commercial release. The producer (MiraKilousE) retains full ownership ' +
    'of the underlying composition and sound recording. Exclusive rights transfer full ' +
    'ownership of the beat to the licensee upon purchase and the beat will be removed ' +
    'from the marketplace. Radio broadcasts are limited to 10,000. No credit is required ' +
    'but is always appreciated.',
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  const out = { ...DEFAULT_SETTINGS }
  for (const r of rows) out[r.key] = r.value
  return out
}

export function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : DEFAULT_SETTINGS[key]
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS)
export function setSettings(patch) {
  const up = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )
  transaction(() => {
    for (const [k, v] of Object.entries(patch)) {
      if (SETTING_KEYS.includes(k)) up.run(k, String(v))
    }
  })
  return getSettings()
}

export function publicSettings() {
  const s = getSettings()
  return {
    siteName: s.site_name,
    producerName: s.producer_name,
    currencyCode: s.currency_code,
    currencySymbol: s.currency_symbol,
    momoProvider: s.momo_provider,
    momoNumber: s.momo_number,
    bankName: s.bank_name,
    bankAccountName: s.bank_account_name,
    bankAccountNumber: s.bank_account_number,
    contactEmail: s.contact_email,
    licenseTerms: s.license_terms,
    paymentAutoConfirm: s.payment_auto_confirm,
  }
}

export default db
