import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { isMongoReady } from '../lib/mongodb.js'

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null
  if (!token || !process.env.JWT_SECRET || !isMongoReady()) return res.status(401).json({ error: 'Authentication required' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(payload.sub)
    if (!req.user) return res.status(401).json({ error: 'User not found' })
    next()
  } catch { res.status(401).json({ error: 'Invalid or expired token' }) }
}
