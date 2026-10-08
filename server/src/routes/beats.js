import { Router } from 'express'
import db, { getSetting } from '../db.js'
import { requireAdmin } from '../auth.js'
import { beatUpload, removeFile } from '../upload.js'

const router = Router()

export function serializeBeat(b) {
  return {
    id: b.id,
    title: b.title,
    producer: b.producer,
    genre: b.genre || '',
    mood: b.mood || '',
    bpm: b.bpm || null,
    key: b.musical_key || '',
    description: b.description || '',
    tags: (b.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    prices: { mp3: b.price_mp3, wav: b.price_wav, exclusive: b.price_exclusive },
    audioUrl: `/uploads/beats/${b.audio_file}`,
    coverUrl: b.cover_file ? `/uploads/covers/${b.cover_file}` : null,
    plays: b.plays,
    createdAt: b.created_at,
  }
}

const SORTS = {
  newest: 'b.created_at DESC',
  popular: 'b.plays DESC',
  price_low: 'min_price ASC',
  price_high: 'min_price DESC',
}

router.get('/', (req, res) => {
  try {
    const { search = '', genre = '', mood = '', sort = 'newest', limit = '24', offset = '0', exclude = '' } = req.query
    const where = []
    const params = []
    if (search) {
      where.push('(b.title LIKE ? OR b.producer LIKE ? OR b.genre LIKE ? OR b.mood LIKE ? OR b.tags LIKE ?)')
      const like = `%${search}%`
      params.push(like, like, like, like, like)
    }
    if (genre) { where.push('b.genre = ?'); params.push(genre) }
    if (mood) { where.push('b.mood = ?'); params.push(mood) }
    if (exclude) { where.push('b.id != ?'); params.push(Number(exclude)) }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
    const sortSql = SORTS[sort] || SORTS.newest
    const lim = Math.min(100, Math.max(1, parseInt(limit, 10) || 24))
    const off = Math.max(0, parseInt(offset, 10) || 0)

    const total = db
      .prepare(`SELECT COUNT(*) AS c FROM beats b ${whereSql}`)
      .get(...params).c
    const rows = db
      .prepare(
        `SELECT b.*, MIN(b.price_mp3, b.price_wav, b.price_exclusive) AS min_price
         FROM beats b ${whereSql}
         GROUP BY b.id
         ORDER BY ${sortSql}
         LIMIT ? OFFSET ?`
      )
      .all(...params, lim, off)

    res.json({ beats: rows.map(serializeBeat), total, limit: lim, offset: off })
  } catch (err) {
    console.error('[beats/list]', err)
    res.status(500).json({ error: 'Failed to load beats' })
  }
})

router.get('/meta', (req, res) => {
  try {
    const genres = db.prepare('SELECT DISTINCT genre FROM beats WHERE genre IS NOT NULL AND genre != \'\' ORDER BY genre').all().map((r) => r.genre)
    const moods = db.prepare('SELECT DISTINCT mood FROM beats WHERE mood IS NOT NULL AND mood != \'\' ORDER BY mood').all().map((r) => r.mood)
    res.json({ genres, moods })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load metadata' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(Number(req.params.id))
    if (!beat) return res.status(404).json({ error: 'Beat not found' })
    const related = db
      .prepare(
        `SELECT * FROM beats WHERE genre = ? AND id != ? ORDER BY plays DESC LIMIT 4`
      )
      .all(beat.genre || '', beat.id)
    res.json({ beat: serializeBeat(beat), related: related.map(serializeBeat) })
  } catch (err) {
    console.error('[beats/get]', err)
    res.status(500).json({ error: 'Failed to load beat' })
  }
})

router.post('/:id/play', (req, res) => {
  try {
    db.prepare('UPDATE beats SET plays = plays + 1 WHERE id = ?').run(Number(req.params.id))
    const beat = db.prepare('SELECT plays FROM beats WHERE id = ?').get(Number(req.params.id))
    res.json({ plays: beat ? beat.plays : 0 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to register play' })
  }
})

function parseBeatFields(body, { partial = false } = {}) {
  const num = (v) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : undefined
  }
  const fields = {
    title: body.title?.trim(),
    producer: body.producer?.trim() || getSetting('producer_name'),
    genre: body.genre?.trim() || null,
    mood: body.mood?.trim() || null,
    bpm: body.bpm ? parseInt(body.bpm, 10) : null,
    musical_key: body.key?.trim() || null,
    description: body.description?.trim() || null,
    tags: body.tags?.trim() || null,
    price_mp3: num(body.price_mp3),
    price_wav: num(body.price_wav),
    price_exclusive: num(body.price_exclusive),
  }
  if (!partial) {
    if (!fields.title) throw Object.assign(new Error('Title is required'), { status: 400 })
    for (const k of ['price_mp3', 'price_wav', 'price_exclusive']) {
      if (fields[k] === undefined || fields[k] < 0) {
        throw Object.assign(new Error(`Valid ${k.replace('price_', '')} price is required`), { status: 400 })
      }
    }
  }
  return fields
}

router.post('/', requireAdmin, (req, res) => {
  beatUpload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    try {
      if (!req.files?.audio?.[0]) return res.status(400).json({ error: 'An audio file is required' })
      const fields = parseBeatFields(req.body)
      const audio = req.files.audio[0]
      const cover = req.files.cover?.[0]
      const info = db
        .prepare(
          `INSERT INTO beats
            (title, producer, genre, mood, bpm, musical_key, description, tags, price_mp3, price_wav, price_exclusive, audio_file, cover_file)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          fields.title, fields.producer, fields.genre, fields.mood, fields.bpm, fields.musical_key,
          fields.description, fields.tags, fields.price_mp3, fields.price_wav, fields.price_exclusive,
          audio.filename, cover ? cover.filename : null
        )
      const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(info.lastInsertRowid)
      res.status(201).json({ beat: serializeBeat(beat) })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Failed to create beat' })
    }
  })
})

router.put('/:id', requireAdmin, (req, res) => {
  beatUpload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    try {
      const id = Number(req.params.id)
      const existing = db.prepare('SELECT * FROM beats WHERE id = ?').get(id)
      if (!existing) return res.status(404).json({ error: 'Beat not found' })
      const fields = parseBeatFields(req.body, { partial: true })
      const sets = []
      const params = []
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) { sets.push(`${k} = ?`); params.push(v) }
      }
      if (req.files?.audio?.[0]) { sets.push('audio_file = ?'); params.push(req.files.audio[0].filename) }
      if (req.files?.cover?.[0]) { sets.push('cover_file = ?'); params.push(req.files.cover[0].filename) }
      if (sets.length) {
        params.push(id)
        db.prepare(`UPDATE beats SET ${sets.join(', ')} WHERE id = ?`).run(...params)
      }
      if (req.files?.audio?.[0]) removeFile('beats', existing.audio_file)
      if (req.files?.cover?.[0] && existing.cover_file) removeFile('covers', existing.cover_file)
      const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(id)
      res.json({ beat: serializeBeat(beat) })
    } catch (e) {
      res.status(e.status || 500).json({ error: e.message || 'Failed to update beat' })
    }
  })
})

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id)
    const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(id)
    if (!beat) return res.status(404).json({ error: 'Beat not found' })
    db.prepare('DELETE FROM beats WHERE id = ?').run(id)
    removeFile('beats', beat.audio_file)
    if (beat.cover_file) removeFile('covers', beat.cover_file)
    res.json({ ok: true })
  } catch (err) {
    console.error('[beats/delete]', err)
    res.status(500).json({ error: 'Failed to delete beat' })
  }
})

export default router
