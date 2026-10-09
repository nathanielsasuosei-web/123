/**
 * Creates the producer account and, on an empty catalogue, five demo beats with real audio.
 *   npm run seed
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, q } from './db.js';
import { hashPassword } from './security.js';
import { renderWav } from './synth.js';
import { slugify, escapeHtml } from './util.js';

const DEMO = [
  { title: 'Accra Nights', genre: 'Afrobeat', mood: 'Chill', bpm: 98, key: 'C minor', root: 36, seed: 11, colors: ['#1e3a8a', '#60a5fa'],
    progression: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], kick: [0, 6, 8, 14], prices: [3000, 5000, 25000], tags: 'afro, log drum, night' },
  { title: 'Kpanlogo Drums', genre: 'Highlife', mood: 'Energetic', bpm: 124, key: 'D minor', root: 38, seed: 23, colors: ['#1d4ed8', '#38bdf8'],
    progression: [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]], kick: [0, 3, 8, 10], prices: [4000, 6000, 30000], tags: 'drums, percussion, party' },
  { title: 'Harmattan', genre: 'Amapiano', mood: 'Dreamy', bpm: 112, key: 'A minor', root: 33, seed: 37, colors: ['#0c4a6e', '#7dd3fc'],
    progression: [[0, 3, 7], [-3, 0, 4], [5, 8, 12], [2, 5, 9]], kick: [0, 7, 10], prices: [3500, 5500, 28000], tags: 'log drum, dusty, pads' },
  { title: 'Trotro Anthem', genre: 'Hip hop', mood: 'Hard', bpm: 90, key: 'F minor', root: 41, seed: 51, colors: ['#172554', '#3b82f6'],
    progression: [[0, 3, 7], [8, 11, 15], [5, 8, 12], [3, 7, 10]], kick: [0, 5, 10], prices: [2500, 4500, 20000], tags: 'boom bap, trap, heavy' },
  { title: 'Midnight in Osu', genre: 'R&B', mood: 'Smooth', bpm: 84, key: 'E minor', root: 40, seed: 67, colors: ['#1e40af', '#93c5fd'],
    progression: [[0, 4, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], kick: [0, 7, 10], prices: [3000, 5000, 22000], tags: 'smooth, keys, slow jam' },
];

const coverSvg = (title, [c1, c2]) => {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const h = 40 + Math.round(Math.abs(Math.sin(i * 0.7)) * 180);
    return `<rect x="${40 + i * 24}" y="${300 - h / 2}" width="12" height="${h}" rx="6" fill="#fff" opacity="0.8"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>${bars}
<text x="50" y="640" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#fff">${escapeHtml(title)}</text>
<text x="50" y="700" font-family="Arial, sans-serif" font-size="28" fill="#dbeafe">Demo beat</text></svg>`;
};

export function ensureProducer() {
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; no producer account created.');
    return;
  }
  const existing = q.get('SELECT id FROM users WHERE email = ?', config.adminEmail);
  if (existing) {
    q.run("UPDATE users SET role = 'admin' WHERE id = ?", existing.id);
    return;
  }
  q.run(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
    config.adminName,
    config.adminEmail,
    hashPassword(config.adminPassword),
  );
  console.log(`[seed] created producer account ${config.adminEmail}`);
}

export function seedDemoBeats() {
  if (q.get('SELECT COUNT(*) AS n FROM beats').n > 0) return 0;
  const dirs = {
    audio: path.join(config.dataDir, 'private', 'audio'),
    previews: path.join(config.dataDir, 'public', 'previews'),
    covers: path.join(config.dataDir, 'public', 'covers'),
  };
  for (const dir of Object.values(dirs)) fs.mkdirSync(dir, { recursive: true });

  for (const b of DEMO) {
    const slug = slugify(b.title);
    const base = `demo-${slug}`;
    const opts = { bpm: b.bpm, root: b.root, seed: b.seed, progression: b.progression, kick: b.kick };
    fs.writeFileSync(path.join(dirs.audio, `${base}.wav`), renderWav({ ...opts, bars: 16 }));
    fs.writeFileSync(path.join(dirs.previews, `${base}.wav`), renderWav({ ...opts, bars: 6 }));
    fs.writeFileSync(path.join(dirs.covers, `${base}.svg`), coverSvg(b.title, b.colors));
    const size = fs.statSync(path.join(dirs.audio, `${base}.wav`)).size;
    q.run(
      `INSERT INTO beats (slug, title, genre, mood, bpm, musical_key, tags, description, price_mp3, price_wav, price_exclusive,
         cover_path, preview_path, audio_path, audio_name, audio_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slug, b.title, b.genre, b.mood, b.bpm, b.key, b.tags,
      `A ${b.mood.toLowerCase()} ${b.genre.toLowerCase()} beat at ${b.bpm} BPM. Demo audio.`,
      ...b.prices,
      `covers/${base}.svg`, `previews/${base}.wav`, `audio/${base}.wav`, `${base}.wav`, size,
    );
  }
  return DEMO.length;
}

// Run directly: `npm run seed`
if (process.argv[1] && import.meta.url === new URL(`file://${path.resolve(process.argv[1])}`).href) {
  ensureProducer();
  const n = seedDemoBeats();
  console.log(n ? `[seed] added ${n} demo beats` : '[seed] catalogue already has beats; demo beats skipped');
  db.close();
}
