import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import db from '../db.js'
import { signToken, authenticate, hashPassword, verifyPassword, publicUser } from '../auth.js'
import { sendMail } from '../mailer.js'
import { welcomeEmail } from '../emailTemplates.js'

const router = Router()

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  message: { error: 'Too many attempts, please try again later.' },
})

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, phone } = req.body || {}
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Please enter your name' })
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address' })
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase())
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

    const info = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(name.trim(), email.trim().toLowerCase(), hashPassword(password), 'artist', phone?.trim() || null)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid)

    sendMail({ to: user.email, ...welcomeEmail(user) }).catch(() => {})
    res.status(201).json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error('[auth/register]', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.post('/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body || {}
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').trim().toLowerCase())
    if (!user || !verifyPassword(password || '', user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error('[auth/login]', err)
    res.status(500).json({ error: 'Login failed' })
  }
})

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

export default router
