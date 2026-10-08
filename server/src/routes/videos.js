import { Router } from 'express'
import db from '../db.js'
import { requireAdmin } from '../auth.js'
import { videoUpload, removeFile } from '../upload.js'

const router = Router()

export function serializeVideo(v) {
  return {
    id: v.id,
    title: v.title,
    description: v.description || '',
    beatId: v.beat_id,
    beatTitle: v.beat_title || null,
    videoUrl: `/uploads/videos/${v.video_file}`,
    thumbnailUrl: v.thumbnail ? `/uploads/thumbs/${v.thumbnail}` : null,
    views: v.views,
    createdAt: v.created_at,
  }
}

const SELECT = `SELECT v.*, b.title AS beat_title FROM videos v LEFT JOIN beats b ON b.id = v.beat_id`

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`${SELECT} ORDER BY v.created_at DESC`).all()
    res.json({ videos: rows.map(serializeVideo) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load videos' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const video = db.prepare(`${SELECT} WHERE v.id = ?`).get(Number(req.params.id))
    if (!video) return res.status(404).json({ error: 'Video not found' })
    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(video.id)
    res.json({ video: serializeVideo({ ...video, views: video.views + 1 }) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load video' })
  }
})

router.post('/', requireAdmin, (req, res) => {
  videoUpload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }])(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message })
    try {
      if (!req.files?.video?.[0]) return res.status(400).json({ error: 'A video file is required' })
      const { title, description = '', beat_id = '' } = req.body || {}
      if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
      const beatId = beat_id ? Number(beat_id) : null
      if (beatId && !db.prepare('SELECT id FROM beats WHERE id = ?').get(beatId)) {
        return res.status(400).json({ error: 'Linked beat not found' })
      }
      const info = db
        .prepare('INSERT INTO videos (title, description, beat_id, video_file, thumbnail) VALUES (?, ?, ?, ?, ?)')
        .run(
          title.trim(),
          description.trim(),
          beatId,
          req.files.video[0].filename,
          req.files.thumbnail?.[0]?.filename || null
        )
      const video = db.prepare(`${SELECT} WHERE v.id = ?`).get(info.lastInsertRowid)
      res.status(201).json({ video: serializeVideo(video) })
    } catch (e) {
      res.status(500).json({ error: e.message || 'Failed to upload video' })
    }
  })
})

router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(Number(req.params.id))
    if (!video) return res.status(404).json({ error: 'Video not found' })
    db.prepare('DELETE FROM videos WHERE id = ?').run(video.id)
    removeFile('videos', video.video_file)
    if (video.thumbnail) removeFile('thumbs', video.thumbnail)
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete video' })
  }
})

export default router
