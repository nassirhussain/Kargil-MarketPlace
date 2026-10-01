import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import Follow from '../models/Follow.js'
import Block from '../models/Block.js'
import Product from '../models/Product.js'
import { isAdmin } from '../lib/admin.js'

const router = Router()
const validId = id => mongoose.isValidObjectId(id)

router.get('/preferences/me', requireAuth, async (req, res, next) => {
  try {
    const [follows, blocks] = await Promise.all([
      Follow.find({ followerId: req.user.id }).select('sellerId').lean(),
      Block.find({ blockerId: req.user.id }).select('blockedId').lean()
    ])
    res.json({ following: follows.map(item => item.sellerId), blocked: blocks.map(item => item.blockedId) })
  } catch (error) { next(error) }
})

router.post('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    const sellerId = req.params.id
    if (!validId(sellerId) || sellerId === req.user.id) return res.status(400).json({ error: 'Choose a valid seller other than yourself' })
    const [seller, blocked] = await Promise.all([
      User.findById(sellerId).select('_id').lean(),
      Block.exists({ $or: [{ blockerId: req.user.id, blockedId: sellerId }, { blockerId: sellerId, blockedId: req.user.id }] })
    ])
    if (!seller) return res.status(404).json({ error: 'Seller not found' })
    if (blocked) return res.status(403).json({ error: 'Following is unavailable because one account has blocked the other' })
    await Follow.updateOne({ followerId: req.user.id, sellerId }, { $setOnInsert: { followerId: req.user.id, sellerId } }, { upsert: true })
    res.json({ following: true, sellerId })
  } catch (error) { next(error) }
})

router.delete('/:id/follow', requireAuth, async (req, res, next) => {
  try {
    await Follow.deleteOne({ followerId: req.user.id, sellerId: req.params.id })
    res.json({ following: false, sellerId: req.params.id })
  } catch (error) { next(error) }
})

router.post('/:id/block', requireAuth, async (req, res, next) => {
  try {
    const blockedId = req.params.id
    if (!validId(blockedId) || blockedId === req.user.id) return res.status(400).json({ error: 'Choose a valid user other than yourself' })
    const user = await User.findById(blockedId).select('_id').lean()
    if (!user) return res.status(404).json({ error: 'User not found' })
    await Promise.all([
      Block.updateOne({ blockerId: req.user.id, blockedId }, { $setOnInsert: { blockerId: req.user.id, blockedId } }, { upsert: true }),
      Follow.deleteMany({ $or: [{ followerId: req.user.id, sellerId: blockedId }, { followerId: blockedId, sellerId: req.user.id }] })
    ])
    res.json({ blocked: true, userId: blockedId })
  } catch (error) { next(error) }
})

router.delete('/:id/block', requireAuth, async (req, res, next) => {
  try {
    await Block.deleteOne({ blockerId: req.user.id, blockedId: req.params.id })
    res.json({ blocked: false, userId: req.params.id })
  } catch (error) { next(error) }
})

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
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const users = await User.find().select('name email phone location role status blocked createdAt').sort({ createdAt: -1 }).limit(500).lean()
    res.json(users.map(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: isAdmin(user) ? 'admin' : 'user',
      status: user.blocked ? (user.status === 'suspended' ? 'suspended' : 'banned') : (user.status || 'active'),
      blocked: Boolean(user.blocked || user.status === 'banned'),
      joinedAt: user.createdAt
    })))
  } catch (error) { next(error) }
})

router.patch('/:id/status', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    if (!validId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    if (String(req.user.id) === req.params.id) return res.status(400).json({ error: 'You cannot suspend your own account' })
    const status = req.body.status
    if (!['active', 'suspended', 'banned'].includes(status)) return res.status(400).json({ error: 'Choose active, suspended, or banned status' })
    const user = await User.findByIdAndUpdate(req.params.id, { status, blocked: status !== 'active' }, { new: true }).select('name status blocked')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: String(user._id), name: user.name, status: user.status, blocked: user.blocked })
  } catch (error) { next(error) }
})

router.patch('/:id/block', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    if (!validId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    if (String(req.user.id) === req.params.id) return res.status(400).json({ error: 'You cannot block your own account' })
    if (typeof req.body.blocked !== 'boolean') return res.status(400).json({ error: 'Blocked must be true or false' })
    const status = req.body.blocked ? 'banned' : 'active'
    const user = await User.findByIdAndUpdate(req.params.id, { status, blocked: req.body.blocked }, { new: true }).select('name status blocked')
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ id: String(user._id), name: user.name, status: user.status, blocked: user.blocked })
  } catch (error) { next(error) }
})

export default router
