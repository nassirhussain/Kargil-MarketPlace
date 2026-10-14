import { isAdmin } from '../lib/admin.js'

export function requireAdmin(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
  next()
}
