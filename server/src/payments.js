import { randomUUID } from 'node:crypto'
import db, { getSettings, getSetting } from './db.js'
import { sendMail } from './mailer.js'
import {
  paymentReceivedEmail,
  newSaleEmail,
  orderPlacedEmail,
  orderPlacedAdminEmail,
} from './emailTemplates.js'

export const LICENSES = ['mp3', 'wav', 'exclusive']

export function priceForLicense(beat, licenseType) {
  if (licenseType === 'mp3') return beat.price_mp3
  if (licenseType === 'wav') return beat.price_wav
  if (licenseType === 'exclusive') return beat.price_exclusive
  return null
}

export function createOrder({ user, beat, licenseType, paymentMethod, payerPhone, bankReference, baseUrl }) {
  const settings = getSettings()
  const amount = priceForLicense(beat, licenseType)
  const token = randomUUID()
  const info = db
    .prepare(
      `INSERT INTO orders
        (user_id, beat_id, license_type, amount, currency, payment_method, payer_phone, bank_reference, status, download_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      user.id,
      beat.id,
      licenseType,
      amount,
      settings.currency_code,
      paymentMethod,
      payerPhone || null,
      bankReference || null,
      token
    )
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid)
  // Notify buyer + admin that an order was placed and is awaiting payment
  sendMail({ to: user.email, ...orderPlacedEmail(order, beat, user, settings, baseUrl) })
  for (const admin of db.prepare("SELECT * FROM users WHERE role = 'admin'").all()) {
    sendMail({ to: admin.email, ...orderPlacedAdminEmail(order, beat, user, settings) })
  }
  // Demo-mode payment provider: simulate the customer approving the payment
  // on their phone / the bank transfer arriving.
  scheduleAutoConfirm(order.id, baseUrl)
  return order
}

export function markOrderPaid(orderId, baseUrl) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId)
  if (!order || order.status !== 'pending') return order
  db.prepare("UPDATE orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(orderId)
  order.status = 'paid'
  order.paid_at = new Date().toISOString()

  const beat = db.prepare('SELECT * FROM beats WHERE id = ?').get(order.beat_id)
  const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id)
  const settings = getSettings()

  // Email the purchased beat (with a secure direct download link) to the buyer
  sendMail({ to: buyer.email, ...paymentReceivedEmail(order, beat, buyer, settings, baseUrl) })
  // Notify the producer
  for (const admin of db.prepare("SELECT * FROM users WHERE role = 'admin'").all()) {
    sendMail({ to: admin.email, ...newSaleEmail(order, beat, buyer, settings) })
  }
  return order
}

export function scheduleAutoConfirm(orderId, baseUrl, delayMs = Number(process.env.PAYMENT_SIM_DELAY_MS || 7000)) {
  if (getSetting('payment_auto_confirm') !== '1') return
  const timer = setTimeout(() => {
    try {
      const o = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId)
      if (o && o.status === 'pending') {
        console.log(`[payments] demo provider approved order #${orderId}`)
        markOrderPaid(orderId, baseUrl)
      }
    } catch (err) {
      console.error('[payments] auto-confirm failed:', err)
    }
  }, delayMs)
  timer.unref?.()
}

export function getBaseUrl(req) {
  return (
    process.env.PUBLIC_URL ||
    req.headers.origin ||
    `${req.protocol}://${req.get('host')}`
  )
}
