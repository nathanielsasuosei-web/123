import { Router } from 'express'
import fs from 'node:fs'
import jwt from 'jsonwebtoken'
import db, { getSettings } from '../db.js'
import { authenticate, requireAdmin } from '../auth.js'
import { createOrder, markOrderPaid, priceForLicense, LICENSES, getBaseUrl } from '../payments.js'
import { filePath } from '../upload.js'
import { serializeBeat } from './beats.js'

const router = Router()

const ORDER_SELECT = `
  SELECT o.*, b.title AS beat_title, b.producer AS beat_producer, b.audio_file AS beat_audio_file,
         u.name AS user_name, u.email AS user_email
  FROM orders o
  JOIN beats b ON b.id = o.beat_id
  JOIN users u ON u.id = o.user_id
`

export function serializeOrder(o, { includeUser = false } = {}) {
  const out = {
    id: o.id,
    status: o.status,
    licenseType: o.license_type,
    amount: o.amount,
    currency: o.currency,
    paymentMethod: o.payment_method,
    payerPhone: o.payer_phone || '',
    bankReference: o.bank_reference || '',
    createdAt: o.created_at,
    paidAt: o.paid_at,
    beat: {
      id: o.beat_id,
      title: o.beat_title,
      producer: o.beat_producer,
      audioFile: o.beat_audio_file,
    },
  }
  if (includeUser) out.user = { id: o.user_id, name: o.user_name, email: o.user_email }
  return out
}

function loadOrderWithBeat(id) {
  return db.prepare(ORDER_SELECT + ' WHERE o.id = ?').get(Number(id))
}

// Create an order (artist checkout)
router.post('/', authenticate, (req, res) => {
  try {
    const { beatId, licenseType, paymentMethod, payerPhone, bankReference } = req.body || {}
    const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(Number(beatId))
    if (!beat) return res.status(404).json({ error: 'Beat not found' })
    if (!LICENSES.includes(licenseType)) {
      return res.status(400).json({ error: 'Invalid license type' })
    }
    if (!['mobile_money', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' })
    }
    if (paymentMethod === 'mobile_money' && (!payerPhone || !/^\+?\d[\d\s-]{6,}$/.test(payerPhone.trim()))) {
      return res.status(400).json({ error: 'A valid Mobile Money phone number is required' })
    }
    if (paymentMethod === 'bank_transfer' && (!bankReference || bankReference.trim().length < 3)) {
      return res.status(400).json({ error: 'Please enter your bank transfer reference / transaction ID' })
    }
    const existing = db
      .prepare("SELECT id FROM orders WHERE user_id = ? AND beat_id = ? AND license_type = ? AND status IN ('pending','paid')")
      .get(req.user.id, beat.id, licenseType)
    if (existing) {
      return res.status(409).json({ error: 'You already have an active order for this beat and license', orderId: existing.id })
    }

    const order = createOrder({
      user: req.user,
      beat,
      licenseType,
      paymentMethod,
      payerPhone: payerPhone?.trim(),
      bankReference: bankReference?.trim(),
      baseUrl: getBaseUrl(req),
    })
    res.status(201).json({ order: serializeOrder(loadOrderWithBeat(order.id)) })
  } catch (err) {
    console.error('[orders/create]', err)
    res.status(500).json({ error: 'Failed to create order' })
  }
})

// My orders (artist)
router.get('/my', authenticate, (req, res) => {
  try {
    const rows = db
      .prepare(ORDER_SELECT + ' WHERE o.user_id = ? ORDER BY o.created_at DESC')
      .all(req.user.id)
    res.json({ orders: rows.map((o) => serializeOrder(o)) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders' })
  }
})

// All orders (admin)
router.get('/', requireAdmin, (req, res) => {
  try {
    const { status } = req.query
    let rows
    if (status && ['pending', 'paid', 'failed', 'refunded', 'cancelled'].includes(status)) {
      rows = db.prepare(ORDER_SELECT + ' WHERE o.status = ? ORDER BY o.created_at DESC').all(status)
    } else {
      rows = db.prepare(ORDER_SELECT + ' ORDER BY o.created_at DESC').all()
    }
    res.json({ orders: rows.map((o) => serializeOrder(o, { includeUser: true })) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load orders' })
  }
})

// Single order (owner or admin)
router.get('/:id', authenticate, (req, res) => {
  try {
    const order = loadOrderWithBeat(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your order' })
    }
    res.json({ order: serializeOrder(order, { includeUser: req.user.role === 'admin' }) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load order' })
  }
})

// Admin confirms a payment manually
router.post('/:id/confirm', requireAdmin, (req, res) => {
  try {
    const order = loadOrderWithBeat(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    markOrderPaid(order.id, getBaseUrl(req))
    res.json({ order: serializeOrder(loadOrderWithBeat(order.id), { includeUser: true }) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to confirm order' })
  }
})

// Admin refunds an order
router.post('/:id/refund', requireAdmin, (req, res) => {
  try {
    const order = loadOrderWithBeat(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'paid') return res.status(400).json({ error: 'Only paid orders can be refunded' })
    db.prepare("UPDATE orders SET status = 'refunded' WHERE id = ?").run(order.id)
    res.json({ order: serializeOrder(loadOrderWithBeat(order.id), { includeUser: true }) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to refund order' })
  }
})

// Buyer cancels their own pending order (or admin cancels any pending order)
router.post('/:id/cancel', authenticate, (req, res) => {
  try {
    const order = loadOrderWithBeat(req.params.id)
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not your order' })
    }
    if (order.status !== 'pending') return res.status(400).json({ error: 'Only pending orders can be cancelled' })
    db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id)
    res.json({ order: serializeOrder(loadOrderWithBeat(order.id)) })
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' })
  }
})

// Download a purchased beat. Works either with a logged-in owner/admin session
// or with the one-click ?token= link that is emailed to the buyer.
function authorizeDownload(req, order) {
  const token = req.query.token
  if (token && token === order.download_token) return true
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return false
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret-change-me')
    if (payload.role === 'admin') return true
    return payload.id === order.user_id
  } catch {
    return false
  }
}

router.get('/:id/download', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id))
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'paid') return res.status(403).json({ error: 'This order has not been paid yet' })
    const ok = authorizeDownload(req, order)
    if (!ok) return res.status(401).json({ error: 'You are not allowed to download this order' })

    const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(order.beat_id)
    if (!beat) return res.status(404).json({ error: 'Beat not found' })
    const abs = filePath('beats', beat.audio_file)
    if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Audio file is missing on the server' })

    db.prepare('INSERT INTO downloads (order_id, user_id, beat_id, license_type) VALUES (?, ?, ?, ?)').run(
      order.id, order.user_id, beat.id, order.license_type
    )
    db.prepare('UPDATE beats SET plays = plays WHERE id = ?').run(beat.id)

    const ext = beat.audio_file.includes('.') ? beat.audio_file.slice(beat.audio_file.lastIndexOf('.')) : '.mp3'
    const safeTitle = beat.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_')
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${safeTitle}_${order.license_type.toUpperCase()}_prod_${beat.producer}${ext}"`
    )
    fs.createReadStream(abs).pipe(res)
  } catch (err) {
    console.error('[orders/download]', err)
    res.status(500).json({ error: 'Download failed' })
  }
})

// License agreement (text) for a paid order
router.get('/:id/license', async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id))
    if (!order) return res.status(404).json({ error: 'Order not found' })
    if (order.status !== 'paid') return res.status(403).json({ error: 'This order has not been paid yet' })
    const ok = authorizeDownload(req, order)
    if (!ok) return res.status(401).json({ error: 'You are not allowed to view this license' })

    const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(order.beat_id)
    const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id)
    const settings = getSettings()
    const licenseName = { mp3: 'MP3 Lease (Non-Exclusive)', wav: 'WAV Lease (Non-Exclusive)', exclusive: 'Exclusive Rights Transfer' }[order.license_type]

    const text = [
      `LICENSE AGREEMENT — ${settings.site_name}`,
      '='.repeat(60),
      '',
      `Order:        #${order.id}`,
      `Date paid:    ${order.paid_at || order.created_at}`,
      `Beat:         ${beat.title}`,
      `Producer:     ${beat.producer}`,
      `Licensee:     ${buyer.name} (${buyer.email})`,
      `License:      ${licenseName}`,
      `Amount paid:  ${settings.currency_symbol}${order.amount.toFixed(2)} ${order.currency}`,
      `Payment:      ${order.payment_method === 'mobile_money' ? `Mobile Money (${order.payer_phone})` : `Bank transfer (ref: ${order.bank_reference})`}`,
      '',
      '-'.repeat(60),
      'TERMS',
      '-'.repeat(60),
      '',
      settings.license_terms,
      '',
      `Exclusive note: the exclusive purchase of "${beat.title}" transfers full ownership`,
      'of the beat to the licensee. The producer retains no rights in the beat.',
      '',
      `Signed electronically via ${settings.site_name} on ${new Date().toISOString()}`,
      '',
    ].join('\n')

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${beat.title.replace(/\s+/g, '_')}_license_agreement.txt"`)
    res.send(text)
  } catch (err) {
    console.error('[orders/license]', err)
    res.status(500).json({ error: 'Failed to generate license' })
  }
})

export default router
