/**
 * Seed script — idempotent. Creates:
 *  - the admin (producer) account
 *  - default site settings
 *  - 6 demo beats: real audio is synthesized as WAV (kick / snare / hats /
 *    bass / chords) and cover art is rendered with ImageMagick
 *  - 2 demo videos: real MP4 files encoded with h264-mp4-encoder (an animated
 *    visualizer), skipped gracefully if the encoder is unavailable
 */
import './src/env.js'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import db, { DEFAULT_SETTINGS } from './src/db.js'
import { hashPassword } from './src/auth.js'
import { uploadsDir } from './src/upload.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const beatsDir = path.join(uploadsDir, 'beats')
const coversDir = path.join(uploadsDir, 'covers')
const videosDir = path.join(uploadsDir, 'videos')
for (const d of [beatsDir, coversDir, videosDir]) fs.mkdirSync(d, { recursive: true })

/* ------------------------------------------------------------------ */
/* Audio synthesis                                                     */
/* ------------------------------------------------------------------ */

const SR = 44100
const TAU = Math.PI * 2
const sine = (f, t) => Math.sin(TAU * f * t)

function kick(t) {
  // pitch sweep 160Hz -> 50Hz, closed-form phase
  const phase = TAU * (50 * t + (110 / 14) * (1 - Math.exp(-14 * t)))
  return Math.sin(phase) * Math.exp(-t * 10)
}
function snare(t) {
  return ((Math.random() * 2 - 1) * 0.6 + sine(190, t) * 0.5 + sine(330, t) * 0.2) * Math.exp(-t * 16)
}
function hat(t, open = false) {
  return (Math.random() * 2 - 1) * Math.exp(-t * (open ? 20 : 55))
}
function bass(freq) {
  return (t) => {
    const env = Math.min(1, t * 30) * Math.exp(-Math.max(0, t - 0.18) * 6)
    return (sine(freq, t) + 0.45 * sine(freq * 2, t) + 0.22 * sine(freq * 3, t)) * env
  }
}
function pad(freqs) {
  return (t, dur) => {
    const attack = Math.min(1, t * 6)
    const release = Math.max(0, Math.min(1, (dur - t) * 4))
    const v = freqs.reduce((s, f, i) => s + sine(f * (i === 0 ? 1 : 1.004), t), 0) / freqs.length
    return v * attack * release
  }
}

function add(buf, gen, start, dur, gain = 1) {
  const s = Math.max(0, Math.floor(start * SR))
  const e = Math.min(buf.l.length, s + Math.floor(dur * SR))
  for (let i = s; i < e; i++) {
    const v = gen((i - s) / SR, dur) * gain
    buf.l[i] += v
    buf.r[i] += v
  }
}

function chordTone(root, scale, deg) {
  const oct = Math.floor(deg / scale.length)
  const idx = deg % scale.length
  return root * Math.pow(2, (scale[idx] + 12 * oct) / 12) * 2
}

function renderBeat(cfg) {
  const step = 60 / cfg.bpm / 4
  const totalSteps = cfg.bars * 16
  const total = totalSteps * step + 1
  const buf = {
    l: new Float32Array(Math.ceil(total * SR)),
    r: new Float32Array(Math.ceil(total * SR)),
  }
  for (let i = 0; i < totalSteps; i++) {
    const t = i * step
    const s = i % 16
    if (cfg.kick.includes(s)) add(buf, kick, t, 0.3, 0.95)
    if (cfg.snare.includes(s)) add(buf, snare, t, 0.2, 0.65)
    if (cfg.hat === '8ths' && s % 2 === 0) add(buf, (tt) => hat(tt), t, 0.06, 0.3)
    if (cfg.hat === '16ths') add(buf, (tt) => hat(tt), t, 0.05, s % 4 === 2 ? 0.34 : 0.22)
    if (cfg.hat === 'offbeats' && s % 4 === 2) add(buf, (tt) => hat(tt), t, 0.06, 0.32)
    if (cfg.openHat === s) add(buf, (tt) => hat(tt, true), t, 0.3, 0.28)
    for (const n of cfg.bass) {
      if (n.s === s) {
        const f = (cfg.root / 2) * Math.pow(2, cfg.scale[n.d] / 12)
        add(buf, bass(f), t, n.l * step + 0.05, 0.55)
      }
    }
    if (s % 4 === 0) {
      const chord = cfg.chords[Math.floor(s / 4) % cfg.chords.length]
      const dur = 4 * step + 0.1
      add(buf, pad(chord.map((d) => chordTone(cfg.root, cfg.scale, d))), t, dur, 0.5)
    }
  }
  if (cfg.noise) add(buf, () => Math.random() * 2 - 1, 0, total, cfg.noise)
  let peak = 0
  for (let i = 0; i < buf.l.length; i++) peak = Math.max(peak, Math.abs(buf.l[i]))
  const g = peak > 0 ? 0.85 / peak : 1
  for (let i = 0; i < buf.l.length; i++) {
    buf.l[i] = Math.tanh(buf.l[i] * g * 1.4) * 0.7
    buf.r[i] = buf.l[i]
  }
  return buf
}

function writeWav(file, buf) {
  const n = buf.l.length
  const dataSize = n * 4
  const buffer = Buffer.alloc(44 + dataSize)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20) // PCM
  buffer.writeUInt16LE(2, 22) // stereo
  buffer.writeUInt32LE(SR, 24)
  buffer.writeUInt32LE(SR * 4, 28)
  buffer.writeUInt16LE(4, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)
  let o = 44
  for (let i = 0; i < n; i++) {
    const l = Math.max(-1, Math.min(1, buf.l[i]))
    const r = Math.max(-1, Math.min(1, buf.r[i]))
    buffer.writeInt16LE(Math.round(l * 32767), o)
    buffer.writeInt16LE(Math.round(r * 32767), o + 2)
    o += 4
  }
  fs.writeFileSync(file, buffer)
}

/* ------------------------------------------------------------------ */
/* Cover art (ImageMagick)                                             */
/* ------------------------------------------------------------------ */

function makeCover(file, title, c1, c2) {
  const size = title.length > 12 ? 62 : 84
  execFileSync(
    'convert',
    [
      '-size', '800x800', `gradient:${c1}-${c2}`,
      '-fill', 'rgba(255,255,255,0.10)', '-draw', 'circle 400,660 400,420',
      '-fill', 'rgba(255,255,255,0.07)', '-draw', 'circle 640,170 640,60',
      '-fill', 'rgba(0,0,0,0.22)', '-draw', 'rectangle 0,600 800,800',
      '-font', 'DejaVu-Sans-Bold', '-pointsize', String(size), '-fill', 'white',
      '-gravity', 'center', '-annotate', '+0-40', title.toUpperCase(),
      '-pointsize', '30', '-fill', 'rgba(255,255,255,0.9)',
      '-gravity', 'south', '-annotate', '+0+50', 'PROD. MIRAKILOUSE',
      `png:${file}`,
    ],
    { stdio: 'pipe' }
  )
}

/* ------------------------------------------------------------------ */
/* Demo videos (real MP4 via h264-mp4-encoder)                         */
/* ------------------------------------------------------------------ */

function hexToRgb(h) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
}

async function makeVideo(file, seed, c1, c2) {
  const mod = await import('h264-mp4-encoder')
  const HME = typeof mod.createH264MP4Encoder === 'function' ? mod : mod.default
  const W = 480
  const H = 270
  const FPS = 12
  const SECONDS = 5
  const frames = FPS * SECONDS
  const bg = new Uint8ClampedArray(W * H * 4)
  const a = hexToRgb(c1)
  const b = hexToRgb(c2)
  for (let y = 0; y < H; y++) {
    const k = y / H
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4
      bg[o] = a[0] + (b[0] - a[0]) * k
      bg[o + 1] = a[1] + (b[1] - a[1]) * k
      bg[o + 2] = a[2] + (b[2] - a[2]) * k
      bg[o + 3] = 255
    }
  }
  const encoder = await HME.createH264MP4Encoder()
  encoder.width = W
  encoder.height = H
  encoder.frameRate = FPS
  encoder.initialize()
  const bars = 24
  const bw = Math.floor(W / bars)
  for (let f = 0; f < frames; f++) {
    const frame = new Uint8ClampedArray(bg)
    for (let i = 0; i < bars; i++) {
      const h = Math.round((Math.abs(Math.sin(f * 0.16 + i * 0.7 + seed)) * 0.8 + 0.2) * H * 0.5)
      const x0 = i * bw + 3
      for (let y = H - h; y < H; y++) {
        for (let x = x0; x < x0 + bw - 6; x++) {
          const o = (y * W + x) * 4
          frame[o] = 255
          frame[o + 1] = 255
          frame[o + 2] = 255
          frame[o + 3] = 255
        }
      }
    }
    const px = Math.floor((f / frames) * W)
    for (let y = 0; y < H; y++) {
      const o = (y * W + px) * 4
      frame[o] = 255
      frame[o + 1] = 220
      frame[o + 2] = 80
      frame[o + 3] = 255
    }
    encoder.addFrameRgba(frame)
  }
  encoder.finalize()
  const mp4 = encoder.FS.readFile(encoder.outputFilename)
  encoder.delete()
  fs.writeFileSync(file, Buffer.from(mp4))
}

/* ------------------------------------------------------------------ */
/* Seed data                                                           */
/* ------------------------------------------------------------------ */

const BEATS = [
  {
    title: 'Midnight Drive', genre: 'Trap', mood: 'Dark', bpm: 140, key: 'F# Minor',
    root: 174.61, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 7, 10], snare: [4, 12], hat: '8ths', openHat: 14,
    bass: [{ s: 0, d: 0, l: 3 }, { s: 7, d: 0, l: 2 }, { s: 10, d: 3, l: 3 }, { s: 14, d: 5, l: 2 }],
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [7, 9, 12]],
    c1: '#312e81', c2: '#7c3aed', prices: [100, 250, 1200],
    tags: 'dark,trap,melodic,aggressive',
    description: 'Hard-hitting dark trap with a rolling 808 bounce and eerie bell melody. Perfect for late-night studio sessions.',
  },
  {
    title: 'Sunset Drill', genre: 'Drill', mood: 'Energetic', bpm: 145, key: 'C# Minor',
    root: 138.59, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 6, 10], snare: [4, 12], hat: '16ths', openHat: 14,
    bass: [{ s: 0, d: 0, l: 2 }, { s: 6, d: 0, l: 2 }, { s: 10, d: 7, l: 3 }, { s: 13, d: 5, l: 3 }],
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [5, 7, 9]],
    c1: '#7f1d1d', c2: '#f97316', prices: [120, 300, 1500],
    tags: 'drill,energetic,aggressive,street',
    description: 'Sliding drill 808s, rapid hi-hats and a menacing piano loop. Made for bold vocal performances.',
  },
  {
    title: 'Afro Bounce', genre: 'Afrobeat', mood: 'Happy', bpm: 102, key: 'A Minor',
    root: 220.0, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 6, 8, 11], snare: [4, 12], hat: '8ths', openHat: 10,
    bass: [{ s: 0, d: 0, l: 4 }, { s: 6, d: 0, l: 2 }, { s: 8, d: 3, l: 3 }, { s: 11, d: 5, l: 2 }, { s: 14, d: 0, l: 2 }],
    chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]],
    c1: '#065f46', c2: '#f59e0b', prices: [90, 220, 1000],
    tags: 'afrobeat,swing,summer,positive',
    description: 'Sunny afro-swing bounce with log drums energy and warm chords. Instant summer vibes.',
  },
  {
    title: 'Rainy Lo-Fi', genre: 'Lo-Fi', mood: 'Chill', bpm: 85, key: 'D Minor',
    root: 146.83, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 8], snare: [4, 12], hat: '8ths', openHat: null,
    bass: [{ s: 0, d: 0, l: 4 }, { s: 8, d: 3, l: 4 }],
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
    noise: 0.018,
    c1: '#1e1b4b', c2: '#0ea5e9', prices: [80, 200, 900],
    tags: 'lofi,chill,study,rainy',
    description: 'Warm dusty lo-fi with vinyl crackle, soft Rhodes chords and a half-time groove. Study and relax.',
  },
  {
    title: 'Club Platinum', genre: 'EDM', mood: 'Energetic', bpm: 128, key: 'A Minor',
    root: 220.0, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 4, 8, 12], snare: [4, 12], hat: 'offbeats', openHat: 14,
    bass: [{ s: 0, d: 0, l: 2 }, { s: 4, d: 0, l: 2 }, { s: 8, d: 0, l: 2 }, { s: 12, d: 7, l: 2 }],
    chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [5, 7, 9]],
    c1: '#4c1d95', c2: '#db2777', prices: [110, 280, 1300],
    tags: 'edm,club,festival,hype',
    description: 'Festival-ready EDM banger with a four-on-the-floor kick, uplifting supersaw chords and festival energy.',
  },
  {
    title: 'Velvet Soul', genre: 'R&B', mood: 'Smooth', bpm: 92, key: 'E Minor',
    root: 164.81, scale: [0, 3, 5, 7, 10], bars: 4,
    kick: [0, 10], snare: [4, 12], hat: '8ths', openHat: null,
    bass: [{ s: 0, d: 0, l: 4 }, { s: 8, d: 3, l: 2 }, { s: 10, d: 5, l: 3 }],
    chords: [[0, 2, 4], [5, 7, 9], [6, 8, 10], [3, 5, 7]],
    noise: 0.008,
    c1: '#831843', c2: '#a855f7', prices: [95, 240, 1100],
    tags: 'rnb,soul,smooth,emotional',
    description: 'Smooth R&B groove with Rhodes-style chords, warm bass and a laid-back bounce for late-night vocals.',
  },
]

const VIDEOS = [
  { title: 'Midnight Drive — Official Beat Video', beatTitle: 'Midnight Drive', c1: '#312e81', c2: '#7c3aed', seed: 1.3 },
  { title: 'Afro Bounce — Visualizer', beatTitle: 'Afro Bounce', c1: '#065f46', c2: '#f59e0b', seed: 2.7 },
]

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main() {
  // settings
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v)

  // admin account
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@mirakilousbeats.com').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  let admin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail)
  if (!admin) {
    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run('MiraKilousE', adminEmail, hashPassword(adminPassword), 'admin', '024 400 0000')
    admin = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)
    console.log('\n🎛  Admin account created:')
    console.log(`   email:    ${adminEmail}`)
    console.log(`   password: ${adminPassword}\n`)
  }

  // beats
  if (db.prepare('SELECT COUNT(*) c FROM beats').get().c === 0) {
    const ins = db.prepare(
      `INSERT INTO beats
        (title, producer, genre, mood, bpm, musical_key, description, tags,
         price_mp3, price_wav, price_exclusive, audio_file, cover_file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    for (const cfg of BEATS) {
      console.log(`🎵 synthesizing "${cfg.title}" (${cfg.bpm} BPM ${cfg.key})...`)
      const buf = renderBeat(cfg)
      const audioName = `${cfg.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}.wav`
      const coverName = `${cfg.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}.png`
      writeWav(path.join(beatsDir, audioName), buf)
      makeCover(path.join(coversDir, coverName), cfg.title, cfg.c1, cfg.c2)
      ins.run(
        cfg.title, 'MiraKilousE', cfg.genre, cfg.mood, cfg.bpm, cfg.key, cfg.description, cfg.tags,
        cfg.prices[0], cfg.prices[1], cfg.prices[2], audioName, coverName
      )
    }
    console.log(`✅ seeded ${BEATS.length} beats`)
  } else {
    console.log('ℹ️  beats already seeded, skipping')
  }

  // videos
  if (db.prepare('SELECT COUNT(*) c FROM videos').get().c === 0) {
    try {
      for (const v of VIDEOS) {
        const beat = db.prepare('SELECT id FROM beats WHERE title = ?').get(v.beatTitle)
        if (!beat) continue
        console.log(`🎬 encoding video "${v.title}"...`)
        const name = `${v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}.mp4`
        await makeVideo(path.join(videosDir, name), v.seed, v.c1, v.c2)
        db.prepare('INSERT INTO videos (title, description, beat_id, video_file) VALUES (?, ?, ?, ?)').run(
          v.title,
          `Official video for the beat "${v.beatTitle}". Produced by MiraKilousE.`,
          beat.id,
          name
        )
      }
      console.log(`✅ seeded ${VIDEOS.length} videos`)
    } catch (err) {
      console.warn('⚠️  video seeding skipped:', err.message)
    }
  } else {
    console.log('ℹ️  videos already seeded, skipping')
  }

  const beats = db.prepare('SELECT COUNT(*) c FROM beats').get().c
  const videos = db.prepare('SELECT COUNT(*) c FROM videos').get().c
  console.log(`\n🌱 Seed complete — ${beats} beats, ${videos} videos in the marketplace.\n`)
}

main().catch((err) => {
  console.error('Seed failed:', err)
  process.exitCode = 1
})
