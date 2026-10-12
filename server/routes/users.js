import { Router } from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import Follow from '../models/Follow.js'
import Block from '../models/Block.js'
import Product from '../models/Product.js'
import { isAdmin } from '../lib/admin.js'
import { requireAdmin } from '../middleware/admin.js'
import { activeAdminFilter, escapeRegex, hasInvalidAdminStrings, paginatedResult, parseAdminPage } from '../lib/adminQueries.js'
import AdminActionLock from '../models/AdminActionLock.js'
import { updateAdminTargetStatus } from '../lib/adminStatus.js'
import { isMongoReady } from '../lib/mongodb.js'

const router = Router()
const validId = id => mongoose.isValidObjectId(id)
const setAccountStatus = async (req, targetId, status) => updateAdminTargetStatus({
  actorId: req.user.id,
  targetId,
  status,
  findUser: id => User.findById(id).select('email role status blocked').lean(),
  isAdmin,
  countActiveAdmins: () => User.countDocuments(activeAdminFilter()),
  acquireLock: async owner => {
    const now = new Date()
    try {
      const lock = await AdminActionLock.findOneAndUpdate(
        { _id: 'active-admin-status', $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }] },
        { $set: { owner, lockedUntil: new Date(now.getTime() + 15_000) } },
        { upsert: true, new: true }
      )
      return lock?.owner === owner
    } catch (error) {
      if (error.code === 11000) return false
      throw error
    }
  },
  releaseLock: owner => AdminActionLock.updateOne(
    { _id: 'active-admin-status', owner },
    { $unset: { owner: 1, lockedUntil: 1 } }
  ),
  updateUser: async id => {
    const updated = await User.findByIdAndUpdate(id, { status, blocked: status !== 'active' }, { new: true }).select('name status blocked')
    return updated
      ? { status: 200, body: { id: String(updated._id), name: updated.name, status: updated.status, blocked: updated.blocked } }
      : { status: 404, error: 'User not found' }
  }
})

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

router.get('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'User management requires the marketplace database.' })
    const page = parseAdminPage(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : 'all'
    if (!page || hasInvalidAdminStrings(req.query, ['q', 'status']) || q.length > 120 || !['all', 'active', 'suspended', 'banned'].includes(status)) {
      return res.status(400).json({ error: 'Invalid user filters or pagination.' })
    }
    const conditions = []
    if (status === 'active') conditions.push({ blocked: { $ne: true }, status: { $nin: ['suspended', 'banned'] } })
    else if (status === 'suspended') conditions.push({ $or: [{ status: 'suspended' }] })
    else if (status === 'banned') conditions.push({ $or: [{ status: 'banned' }, { blocked: true, status: { $ne: 'suspended' } }] })
    if (q) {
      const expression = new RegExp(escapeRegex(q), 'i')
      conditions.push({ $or: [{ name: expression }, { email: expression }, { phone: expression }, { location: expression }] })
    }
    const filter = conditions.length ? { $and: conditions } : {}
    const [records, total] = await Promise.all([
      User.find(filter).select('name email phone location role status blocked createdAt').sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.pageSize).lean(),
      User.countDocuments(filter)
    ])
    res.json(paginatedResult(records.map(user => ({
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      location: user.location,
      role: isAdmin(user) ? 'admin' : 'user',
      status: user.blocked ? (user.status === 'suspended' ? 'suspended' : 'banned') : (user.status || 'active'),
      blocked: Boolean(user.blocked || user.status === 'banned'),
      joinedAt: user.createdAt
    })), total, page))
  } catch (error) { next(error) }
})

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    const status = req.body.status
    if (!isMongoReady()) return res.status(503).json({ error: 'User management requires the marketplace database.' })
    const result = await setAccountStatus(req, req.params.id, status)
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.status(result.status).json(result.body)
  } catch (error) { next(error) }
})

router.patch('/:id/block', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(404).json({ error: 'User not found' })
    if (String(req.user.id) === req.params.id) return res.status(400).json({ error: 'You cannot block your own account' })
    if (typeof req.body.blocked !== 'boolean') return res.status(400).json({ error: 'Blocked must be true or false' })
    if (!isMongoReady()) return res.status(503).json({ error: 'User management requires the marketplace database.' })
    const result = await setAccountStatus(req, req.params.id, req.body.blocked ? 'banned' : 'active')
    if (result.error) return res.status(result.status).json({ error: result.error })
    res.status(result.status).json(result.body)
  } catch (error) { next(error) }
})

export default router
