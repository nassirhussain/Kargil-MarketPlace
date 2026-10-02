import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { isMongoReady } from '../lib/mongodb.js'
import { isAdmin } from '../lib/admin.js'

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  if (!process.env.JWT_SECRET || !isMongoReady()) {
    return res.status(503).json({ error: 'Authentication is temporarily unavailable because the backend is not configured.' })
  }
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string') return res.status(401).json({ error: 'Invalid authentication token' })
  req.user = await User.findById(payload.sub)
  if (!req.user) return res.status(401).json({ error: 'User not found' })
  const status = req.user.blocked
    ? (req.user.status === 'suspended' ? 'suspended' : 'banned')
    : (req.user.status || 'active')
  if (status !== 'active') return res.status(403).json({ error: `This account is ${status}. Contact support if you believe this is a mistake.` })
  req.user.role = isAdmin(req.user) ? 'admin' : 'user'
  next()
}
