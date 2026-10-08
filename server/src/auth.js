import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import db from './db.js'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
if (SECRET === 'dev-secret-change-me') {
  console.warn('[auth] WARNING: using the default JWT secret. Set JWT_SECRET in server/.env')
}

export const hashPassword = (pw) => bcrypt.hashSync(pw, 10)
export const verifyPassword = (pw, hash) => bcrypt.compareSync(pw, hash)

export const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, SECRET, { expiresIn: '7d' })

export function publicUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    phone: u.phone || '',
    createdAt: u.created_at,
  }
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    const payload = jwt.verify(token, SECRET)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.id)
    if (!user) return res.status(401).json({ error: 'Account no longer exists' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session, please log in again' })
  }
}

export function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  })
}
