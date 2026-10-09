/**
 * Creates the producer account and, when the catalogue is empty, a set of demo beats
 * (real WAV audio + cover art generated locally). Safe to run more than once.
 *
 *   npm run seed
 */
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { db, q } from './db.js';
import { hashPassword } from './auth.js';
import { renderWav } from './lib/synth.js';
import { slugify, escapeHtml } from './lib/util.js';

const DEMO_BEATS = [
  { title: 'Accra Nights', genre: 'Afrobeat', mood: 'Chill', bpm: 98, key: 'C minor', root: 36, seed: 11,
    progression: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], kick: [0, 6, 8, 14],
    price: [3000, 5000, 25000], color: ['#1e3a8a', '#60a5fa'], tags: 'afro, log drum, night' },
  { title: 'Kpanlogo Drums', genre: 'Highlife', mood: 'Energetic', bpm: 124, key: 'D minor', root: 38, seed: 23,
    progression: [[0, 3, 7], [5, 8, 12], [7, 10, 14], [3, 7, 10]], kick: [0, 3, 8, 10],
    price: [4000, 6000, 30000], color: ['#1d4ed8', '#38bdf8'], tags: 'drums, percussion, party' },
  { title: 'Harmattan', genre: 'Amapiano', mood: 'Dreamy', bpm: 112, key: 'A minor', root: 33, seed: 37,
    progression: [[0, 3, 7], [-3, 0, 4], [5, 8, 12], [2, 5, 9]], kick: [0, 7, 10],
    price: [3500, 5500, 28000], color: ['#0c4a6e', '#7dd3fc'], tags: 'log drum, dusty, pads' },
  { title: 'Trotro Anthem', genre: 'Hip hop', mood: 'Hard', bpm: 90, key: 'F minor', root: 41, seed: 51,
    progression: [[0, 3, 7], [8, 11, 15], [5, 8, 12], [3, 7, 10]], kick: [0, 5, 10],
    price: [2500, 4500, 20000], color: ['#172554', '#3b82f6'], tags: 'boom bap, trap, heavy' },
  { title: 'Midnight in Osu', genre: 'R&B', mood: 'Smooth', bpm: 84, key: 'E minor', root: 40, seed: 67,
    progression: [[0, 4, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], kick: [0, 7, 10],
    price: [3000, 5000, 22000], color: ['#1e40af', '#93c5fd'], tags: 'smooth, keys, slow jam' },
];

function coverSvg(title, [c1, c2]) {
  const bars = Array.from({ length: 24 }, (_, i) => {
    const h = 40 + Math.round(Math.abs(Math.sin(i * 0.7)) * 180);
    return `<rect x="${40 + i * 24}" y="${300 - h / 2}" width="12" height="${h}" rx="6" fill="#ffffff" opacity="0.8"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#g)"/>${bars}
<text x="50" y="640" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${escapeHtml(title)}</text>
<text x="50" y="700" font-family="Arial, sans-serif" font-size="28" fill="#dbeafe">Demo beat</text></svg>`;
}

export function ensureAdmin() {
  if (!config.adminEmail || !config.adminPassword) {
    console.warn('[seed] ADMIN_EMAIL / ADMIN_PASSWORD not set; no producer account created.');
    return;
  }
  const existing = q.get('SELECT id FROM users WHERE email = ?', config.adminEmail);
  if (existing) {
    q.run("UPDATE users SET role = 'admin' WHERE id = ?", existing.id);
  } else {
    q.run(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      config.adminName,
      config.adminEmail,
      hashPassword(config.adminPassword),
    );
    console.log(`[seed] created producer account ${config.adminEmail}`);
  }
}

export function seedDemoBeats() {
  const count = q.get('SELECT COUNT(*) AS n FROM beats').n;
  if (count > 0) return 0;

  const audioDir = path.join(config.dataDir, 'private', 'audio');
  const previewDir = path.join(config.dataDir, 'public', 'previews');
  const coverDir = path.join(config.dataDir, 'public', 'covers');
  for (const dir of [audioDir, previewDir, coverDir]) fs.mkdirSync(dir, { recursive: true });

  let created = 0;
  for (const beat of DEMO_BEATS) {
    const slug = slugify(beat.title);
    const base = `demo-${slug}`;
    const full = renderWav({ bpm: beat.bpm, bars: 16, root: beat.root, seed: beat.seed, progression: beat.progression, kickSteps: beat.kick });
    const preview = renderWav({ bpm: beat.bpm, bars: 6, root: beat.root, seed: beat.seed, progression: beat.progression, kickSteps: beat.kick });
    fs.writeFileSync(path.join(audioDir, `${base}.wav`), full);
    fs.writeFileSync(path.join(previewDir, `${base}.wav`), preview);
    fs.writeFileSync(path.join(coverDir, `${base}.svg`), coverSvg(beat.title, beat.color));

    q.run(
      `INSERT INTO beats (slug, title, genre, mood, bpm, musical_key, tags, description, price_mp3, price_wav, price_exclusive,
         cover_path, preview_path, audio_path, audio_name, audio_mime, audio_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      slug,
      beat.title,
      beat.genre,
      beat.mood,
      beat.bpm,
      beat.key,
      beat.tags,
      `A ${beat.mood.toLowerCase()} ${beat.genre.toLowerCase()} beat at ${beat.bpm} BPM. Demo audio generated for testing.`,
      beat.price[0],
      beat.price[1],
      beat.price[2],
      `covers/${base}.svg`,
      `previews/${base}.wav`,
      `audio/${base}.wav`,
      `${base}.wav`,
      'audio/wav',
      full.length,
    );
    created++;
  }
  return created;
}

// Run directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureAdmin();
  const n = seedDemoBeats();
  console.log(n ? `[seed] added ${n} demo beats` : '[seed] catalogue already has beats, skipped demo beats');
  db.close();
}
