import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Seller not found' })
    const user = await User.findById(req.params.id)
      .select('name location area avatar createdAt emailVerified phoneVerified')
      .lean()
    if (!user) return res.status(404).json({ error: 'Seller not found' })
    res.json({
      id: String(user._id),
      name: user.name,
      location: user.location,
      area: user.area,
      avatar: user.avatar,
      joinedAt: user.createdAt,
      verified: Boolean(user.emailVerified || user.phoneVerified),
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified)
    })
  } catch (error) { next(error) }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    const users = await User.find().select('name email phone location role blocked createdAt').sort({ createdAt: -1 }).limit(500).lean()
    res.json(users.map(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: user.role,
      blocked: Boolean(user.blocked),
      joinedAt: user.createdAt
    })))
  } catch (error) { next(error) }
})

router.patch('/:id/block', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    if (String(req.user.id) === req.params.id) return res.status(400).json({ error: 'You cannot block your own account' })
    if (typeof req.body.blocked !== 'boolean') return res.status(400).json({ error: 'Blocked must be true or false' })
    const user = await User.findByIdAndUpdate(req.params.id, { blocked: req.body.blocked }, { new: true }).select('name blocked')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: String(user._id), name: user.name, blocked: user.blocked })
  } catch (error) { next(error) }
})

export default router
