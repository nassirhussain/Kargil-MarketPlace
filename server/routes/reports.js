import { Router } from 'express'
import Product from '../models/Product.js'
import Report from '../models/Report.js'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { targetType, targetId, reason, details = '' } = req.body
    if (!['listing', 'seller'].includes(targetType) || typeof targetId !== 'string' || !targetId.trim()) {
      return res.status(400).json({ error: 'Choose a valid listing or seller to report' })
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 120) {
      return res.status(400).json({ error: 'Choose a report reason' })
    }
    if (typeof details !== 'string' || details.length > 1000) {
      return res.status(400).json({ error: 'Report details must be 1000 characters or fewer' })
    }
    let targetName
    if (targetType === 'listing') {
      const product = await Product.findOne({ id: targetId.trim() }).select('title').lean()
      if (!product) return res.status(404).json({ error: 'Listing not found' })
      targetName = product.title || 'Marketplace listing'
    } else {
      const seller = await User.findById(targetId.trim()).select('name').lean()
      if (!seller) return res.status(404).json({ error: 'Seller not found' })
      targetName = seller.name
    }
    const report = await Report.create({
      targetType,
      targetId: targetId.trim(),
      targetName,
      reporterId: req.user.id,
      reason: reason.trim(),
      details: details.trim()
    })
    res.status(201).json({ id: report.id, status: report.status })
  } catch (error) { next(error) }
})

router.get('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    const reports = await Report.find().sort({ createdAt: -1 }).limit(200).lean()
    res.json(reports.map(({ _id, __v, ...report }) => ({ ...report, id: String(_id) })))
  } catch (error) { next(error) }
})

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    if (!['reviewed', 'dismissed'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Choose reviewed or dismissed status' })
    }
    const report = await Report.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true })
    if (!report) return res.status(404).json({ error: 'Report not found' })
    res.json({ id: report.id, status: report.status })
  } catch (error) { next(error) }
})

export default router
