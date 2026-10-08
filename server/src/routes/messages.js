import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { authenticate, requireAdmin, publicUser } from '../auth.js'
import { sendMail } from '../mailer.js'
import { newMessageEmail } from '../emailTemplates.js'
import { getBaseUrl } from '../payments.js'

const router = Router()

const msgLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: { error: 'You are sending messages too fast.' },
})

export function serializeMessage(m) {
  return {
    id: m.id,
    senderId: m.sender_id,
    recipientId: m.recipient_id,
    body: m.body,
    readAt: m.read_at,
    createdAt: m.created_at,
    senderName: m.sender_name,
    senderRole: m.sender_role,
  }
}

const MSG_SELECT = `
  SELECT m.*, u.name AS sender_name, u.role AS sender_role
  FROM messages m JOIN users u ON u.id = m.sender_id
`

function getAdmin() {
  return db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get()
}

function resolvePeer(req) {
  // Artists chat with the producer (admin); admins chat with a specific artist.
  if (req.user.role === 'artist') {
    const admin = getAdmin()
    if (!admin) throw Object.assign(new Error('The producer is not available yet.'), { status: 404 })
    return admin
  }
  const withId = Number(req.query.with)
  if (!withId) throw Object.assign(new Error('Missing ?with=<userId>'), { status: 400 })
  const peer = db.prepare('SELECT * FROM users WHERE id = ?').get(withId)
  if (!peer) throw Object.assign(new Error('User not found'), { status: 404 })
  return peer
}

// Thread between the current user and a peer
router.get('/thread', authenticate, (req, res) => {
  try {
    const peer = resolvePeer(req)
    const messages = db
      .prepare(
        `${MSG_SELECT}
         WHERE (m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?)
         ORDER BY m.id ASC`
      )
      .all(req.user.id, peer.id, peer.id, req.user.id)
    // mark messages sent TO me as read
    db.prepare('UPDATE messages SET read_at = datetime(\'now\') WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL')
      .run(peer.id, req.user.id)
    res.json({ peer: publicUser(peer), messages: messages.map(serializeMessage) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to load messages' })
  }
})

// Admin: list of conversations with artists
router.get('/conversations', requireAdmin, (req, res) => {
  try {
    const adminId = req.user.id
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, u.phone, u.created_at,
          (SELECT m.body FROM messages m
            WHERE (m.sender_id = u.id AND m.recipient_id = ?)
               OR (m.sender_id = ? AND m.recipient_id = u.id)
            ORDER BY m.id DESC LIMIT 1) AS last_body,
          (SELECT m.created_at FROM messages m
            WHERE (m.sender_id = u.id AND m.recipient_id = ?)
               OR (m.sender_id = ? AND m.recipient_id = u.id)
            ORDER BY m.id DESC LIMIT 1) AS last_at,
          (SELECT COUNT(*) FROM messages m
            WHERE m.sender_id = u.id AND m.recipient_id = ? AND m.read_at IS NULL) AS unread
         FROM users u
         WHERE u.role = 'artist'
         ORDER BY last_at DESC NULLS LAST`
      )
      .all(adminId, adminId, adminId, adminId, adminId)
    res.json({
      conversations: rows
        .filter((r) => r.last_body !== null)
        .map((r) => ({ ...publicUser(r), lastBody: r.last_body, lastAt: r.last_at, unread: r.unread })),
    })
  } catch (err) {
    console.error('[messages/conversations]', err)
    res.status(500).json({ error: 'Failed to load conversations' })
  }
})

// Send a message
router.post('/', authenticate, msgLimiter, (req, res) => {
  try {
    const { recipientId, body } = req.body || {}
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' })
    const peer = resolvePeer(req)
    if (req.user.role === 'artist' && peer.role !== 'admin') {
      return res.status(400).json({ error: 'Artists can only message the producer' })
    }
    const recipient = req.user.role === 'artist' ? peer : db.prepare('SELECT * FROM users WHERE id = ?').get(Number(recipientId))
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' })

    const info = db
      .prepare('INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)')
      .run(req.user.id, recipient.id, body.trim().slice(0, 4000))
    const message = db.prepare(`${MSG_SELECT} WHERE m.id = ?`).get(info.lastInsertRowid)

    // email notification to the recipient
    sendMail({
      to: recipient.email,
      ...newMessageEmail(req.user, recipient, message.body, getBaseUrl(req)),
    }).catch(() => {})

    res.status(201).json({ message: serializeMessage(message) })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'Failed to send message' })
  }
})

// Mark a message read
router.post('/:id/read', authenticate, (req, res) => {
  try {
    db.prepare("UPDATE messages SET read_at = datetime('now') WHERE id = ? AND recipient_id = ?").run(
      Number(req.params.id),
      req.user.id
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark message read' })
  }
})

export default router
