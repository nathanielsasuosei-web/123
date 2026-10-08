import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import db, { publicSettings, getSettings } from '../db.js'
import { sendMail } from '../mailer.js'
import { contactEmail } from '../emailTemplates.js'
import { getBaseUrl } from '../payments.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ ok: true, name: 'MiraKilousE Beats API', time: new Date().toISOString() })
})

// Public site settings (used at checkout to show MoMo number / bank details)
router.get('/settings/public', (req, res) => {
  res.json({ settings: publicSettings() })
})

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many messages, please try again later.' },
})

router.post('/contact', contactLimiter, (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {}
    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'All fields are required' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please enter a valid email address' })
    }
    const settings = getSettings()
    sendMail({
      to: settings.contact_email,
      ...contactEmail({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() }),
    }).catch(() => {})
    res.json({ ok: true, message: 'Message sent! We will get back to you by email.' })
  } catch (err) {
    console.error('[contact]', err)
    res.status(500).json({ error: 'Failed to send message' })
  }
})

export default router
