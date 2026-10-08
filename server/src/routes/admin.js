import { Router } from 'express'
import db, { setSettings, publicSettings } from '../db.js'
import { requireAdmin, publicUser } from '../auth.js'
import { serializeOrder } from './orders.js'

const router = Router()

router.use(requireAdmin)

router.get('/stats', (req, res) => {
  try {
    const q = (sql) => db.prepare(sql).get()
    const stats = {
      artists: q("SELECT COUNT(*) c FROM users WHERE role = 'artist'").c,
      beats: q('SELECT COUNT(*) c FROM beats').c,
      videos: q('SELECT COUNT(*) c FROM videos').c,
      orders: q('SELECT COUNT(*) c FROM orders').c,
      pendingOrders: q("SELECT COUNT(*) c FROM orders WHERE status = 'pending'").c,
      revenue: q("SELECT COALESCE(SUM(amount), 0) s FROM orders WHERE status = 'paid'").s,
      currency: db.prepare('SELECT value FROM settings WHERE key = \'currency_code\'').get()?.value || 'GHS',
      totalPlays: q('SELECT COALESCE(SUM(plays), 0) s FROM beats').s,
      totalViews: q('SELECT COALESCE(SUM(views), 0) s FROM videos').s,
    }
    const recentOrders = db
      .prepare(
        `SELECT o.*, b.title AS beat_title, b.producer AS beat_producer, b.audio_file AS beat_audio_file,
                u.name AS user_name, u.email AS user_email
         FROM orders o JOIN beats b ON b.id = o.beat_id JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC LIMIT 6`
      )
      .all()
      .map((o) => serializeOrder(o, { includeUser: true }))
    const topBeats = db
      .prepare('SELECT id, title, producer, genre, plays, cover_file FROM beats ORDER BY plays DESC LIMIT 5')
      .all()
      .map((b) => ({ ...b, coverUrl: b.cover_file ? `/uploads/covers/${b.cover_file}` : null }))
    res.json({ stats, recentOrders, topBeats })
  } catch (err) {
    console.error('[admin/stats]', err)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

router.get('/users', (req, res) => {
  try {
    const users = db
      .prepare(
        `SELECT u.*, (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id) AS order_count
         FROM users u WHERE u.role = 'artist' ORDER BY u.created_at DESC`
      )
      .all()
      .map((u) => ({ ...publicUser(u), orderCount: u.order_count }))
    res.json({ users })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load users' })
  }
})

// Mailbox — every email the system "sent" (demo mode shows them here)
router.get('/mailbox', (req, res) => {
  try {
    const emails = db
      .prepare('SELECT id, to_email, subject, status, created_at FROM emails ORDER BY id DESC LIMIT 200')
      .all()
      .map((e) => ({ id: e.id, to: e.to_email, subject: e.subject, status: e.status, createdAt: e.created_at }))
    res.json({ emails })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load mailbox' })
  }
})

router.get('/mailbox/:id', (req, res) => {
  try {
    const email = db
      .prepare('SELECT id, to_email, subject, html, text, status, created_at FROM emails WHERE id = ?')
      .get(Number(req.params.id))
    if (!email) return res.status(404).json({ error: 'Email not found' })
    res.json({
      email: {
        id: email.id,
        to: email.to_email,
        subject: email.subject,
        html: email.html,
        text: email.text,
        status: email.status,
        createdAt: email.created_at,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load email' })
  }
})

router.get('/settings', (req, res) => {
  res.json({ settings: publicSettings() })
})

router.put('/settings', (req, res) => {
  try {
    const allowed = {
      site_name: (v) => (typeof v === 'string' ? v.trim().slice(0, 80) : undefined),
      producer_name: (v) => (typeof v === 'string' ? v.trim().slice(0, 80) : undefined),
      currency_code: (v) => (typeof v === 'string' ? v.trim().toUpperCase().slice(0, 8) : undefined),
      currency_symbol: (v) => (typeof v === 'string' ? v.trim().slice(0, 8) : undefined),
      momo_provider: (v) => (typeof v === 'string' ? v.trim().slice(0, 80) : undefined),
      momo_number: (v) => (typeof v === 'string' ? v.trim().slice(0, 40) : undefined),
      bank_name: (v) => (typeof v === 'string' ? v.trim().slice(0, 120) : undefined),
      bank_account_name: (v) => (typeof v === 'string' ? v.trim().slice(0, 120) : undefined),
      bank_account_number: (v) => (typeof v === 'string' ? v.trim().slice(0, 60) : undefined),
      contact_email: (v) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v.trim() : undefined),
      payment_auto_confirm: (v) => (['0', '1', 0, 1, true, false].includes(v) ? String(Number(v === true || v === 1 || v === '1')) : undefined),
      license_terms: (v) => (typeof v === 'string' ? v.slice(0, 4000) : undefined),
    }
    const patch = {}
    const errors = []
    for (const [k, fn] of Object.entries(allowed)) {
      if (req.body?.[k] !== undefined) {
        const v = fn(req.body[k])
        if (v === undefined) errors.push(`Invalid value for ${k}`)
        else patch[k] = v
      }
    }
    if (errors.length) return res.status(400).json({ error: errors.join('. ') })
    setSettings(patch)
    res.json({ settings: publicSettings() })
  } catch (err) {
    console.error('[admin/settings]', err)
    res.status(500).json({ error: 'Failed to save settings' })
  }
})

export default router
