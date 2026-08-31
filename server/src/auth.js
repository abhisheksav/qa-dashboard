import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { pool } from './db.js'

export async function login(email, password) {
  const { rows } = await pool.query(
    'select id, email, password_hash, name from users where email = $1',
    [email.trim().toLowerCase()],
  )
  const user = rows[0]
  if (!user) return null

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) return null

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '7d' },
  )
  return { token, user: { email: user.email, name: user.name } }
}

/** Rejects with 401 unless the request carries a valid, unexpired token. */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Missing token.' })

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired session.' })
  }
}
