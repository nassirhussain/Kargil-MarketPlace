import { Router } from 'express'
import Product from '../models/Product.js'
import Report from '../models/Report.js'
import User from '../models/User.js'
import Conversation from '../models/Conversation.js'
import { requireAuth } from '../middleware/auth.js'
import { isAdmin } from '../lib/admin.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
router.use(requireAuth)
router.post('/', rateLimit({ limit: 5, windowMs: 60 * 60_000, keyPrefix: 'reports' }))

router.post('/', async (req, res, next) => {
  try {
    const { targetType, targetId, reason, details = '' } = req.body
    if (!['listing', 'seller', 'message'].includes(targetType) || typeof targetId !== 'string' || !targetId.trim() || targetId.length > 180) {
      return res.status(400).json({ error: 'Choose a valid listing, seller, or message to report' })
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 120) {
      return res.status(400).json({ error: 'Choose a report reason' })
    }
    if (typeof details !== 'string' || details.length > 1000) {
      return res.status(400).json({ error: 'Report details must be 1000 characters or fewer' })
    }
    let targetName
    let reportedUserId
    if (targetType === 'listing') {
      const product = await Product.findOne({ id: targetId.trim() }).select('title sellerId').lean()
      if (!product) return res.status(404).json({ error: 'Listing not found' })
      if (product.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot report your own listing' })
      targetName = product.title || 'Marketplace listing'
      reportedUserId = product.sellerId
    } else {
      if (targetType === 'seller') {
        if (!/^[a-f\d]{24}$/i.test(targetId.trim())) return res.status(404).json({ error: 'Seller not found' })
        const seller = await User.findById(targetId.trim()).select('name').lean()
        if (!seller) return res.status(404).json({ error: 'Seller not found' })
        if (String(seller._id) === req.user.id) return res.status(400).json({ error: 'You cannot report yourself' })
        targetName = seller.name
        reportedUserId = String(seller._id)
      } else {
        const [conversationId, messageIndexValue, ...extra] = targetId.trim().split(':')
        const messageIndex = Number(messageIndexValue)
        if (!conversationId || extra.length || !Number.isInteger(messageIndex) || messageIndex < 0) return res.status(404).json({ error: 'Message not found' })
        const conversation = await Conversation.findOne({ id: conversationId })
        if (!conversation || ![conversation.buyerId, conversation.sellerId].includes(req.user.id)) return res.status(404).json({ error: 'Message not found' })
        const message = conversation.messages[messageIndex]
        if (!message || message.senderId === req.user.id) return res.status(404).json({ error: 'Message not found' })
        targetName = `Message: ${message.text.slice(0, 100)}`
        reportedUserId = message.senderId
      }
    }
    const reportKey = `${req.user.id}:${targetType}:${targetId.trim()}`
    const existingActiveReport = await Report.exists({
      reporterId: req.user.id,
      targetType,
      targetId: targetId.trim(),
      status: { $in: ['Pending', 'Reviewing'] }
    })
    if (existingActiveReport) return res.status(409).json({ error: 'You have already reported this item' })
    const report = await Report.create({
      targetType,
      targetId: targetId.trim(),
      targetName,
      reporterId: req.user.id,
      reason: reason.trim(),
      details: details.trim(),
      reportedUserId,
      activeKey: reportKey
    })
    res.status(201).json({ id: report.id, status: report.status })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'You have already reported this item' })
    next(error)
  }
})

router.get('/', async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const status = req.query.status
    const filter = status && ['Pending', 'Reviewing', 'Resolved', 'Rejected'].includes(status) ? { status } : {}
    const reports = await Report.find(filter).sort({ createdAt: -1 }).limit(200).lean()
    res.json(reports.map(({ _id, __v, ...report }) => ({ ...report, id: String(_id) })))
  } catch (error) { next(error) }
})

router.patch('/:id', async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    if (!['Pending', 'Reviewing', 'Resolved', 'Rejected'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Choose Pending, Reviewing, Resolved, or Rejected status' })
    }
    const existing = await Report.findById(req.params.id).select('reporterId targetType targetId')
    if (!existing) return res.status(404).json({ error: 'Report not found' })
    const isActive = ['Pending', 'Reviewing'].includes(req.body.status)
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: req.body.status,
          ...(isActive ? { activeKey: `${existing.reporterId}:${existing.targetType}:${existing.targetId}` } : {})
        },
        ...(!isActive ? { $unset: { activeKey: 1 } } : {})
      },
      { new: true }
    )
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({ id: report.id, status: report.status })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'Another active report already exists for this item' })
    next(error)
  }
})

export default router
