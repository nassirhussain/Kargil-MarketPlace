import { Router } from 'express'
import Product from '../models/Product.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import Category from '../models/Category.js'
import Shop from '../models/Shop.js'
import Hotel from '../models/Hotel.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { escapeRegex, paginatedResult, parseAdminPage } from '../lib/adminQueries.js'
import { businessStatusFilter, validateBusinessModeration } from '../lib/businessModeration.js'

const router = Router()
router.use(requireAuth, requireAdmin)

const businessModels = { shop: Shop, hotel: Hotel }

router.get('/businesses', async (req, res, next) => {
  try {
    const kind = req.query.kind
    const Model = businessModels[kind]
    const page = parseAdminPage(req.query)
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : ''
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : ''
    const status = typeof req.query.status === 'string' ? req.query.status : 'all'
    if (!Model || !page || q.length > 120 || category.length > 80 || location.length > 120 ||
        !['all', 'legacy', 'pending', 'approved', 'rejected', 'suspended'].includes(status) ||
        ['q', 'category', 'location', 'status'].some(key => req.query[key] !== undefined && typeof req.query[key] !== 'string')) {
      return res.status(400).json({ error: 'Invalid business filters or pagination.' })
    }
    const conditions = []
    if (status !== 'all') conditions.push(businessStatusFilter(status))
    if (category) conditions.push({ category: new RegExp(escapeRegex(category), 'i') })
    if (location) conditions.push({ location: new RegExp(escapeRegex(location), 'i') })
    if (q) {
      const expression = new RegExp(escapeRegex(q), 'i')
      const ownerMatches = await User.find({ $or: [{ name: expression }, { email: expression }, { phone: expression }] }).distinct('_id')
      conditions.push({ $or: [
        { name: expression },
        { category: expression },
        { location: expression },
        { contactNumber: expression },
        { ownerId: { $in: ownerMatches.map(String) } }
      ] })
    }
    const filter = conditions.length ? { $and: conditions } : {}
    const [records, total] = await Promise.all([
      Model.find(filter).sort({ createdAt: -1, _id: -1 }).skip(page.skip).limit(page.pageSize).lean(),
      Model.countDocuments(filter)
    ])
    const categoryNames = (await Model.distinct('category')).filter(value => typeof value === 'string' && value.trim()).sort()
    const ownerIds = [...new Set(records.map(record => record.ownerId).filter(Boolean))]
    const owners = ownerIds.length
      ? await User.find({ _id: { $in: ownerIds } }).select('name email phone').lean()
      : []
    const ownerById = new Map(owners.map(owner => [String(owner._id), owner]))
    res.json({
      ...paginatedResult(records.map(({ _id, __v, moderationReason, ...record }) => {
      const owner = ownerById.get(String(record.ownerId))
      return {
        ...record,
        id: String(record.id),
        approvalStatus: record.approvalStatus || 'legacy',
        verified: record.approvalStatus === 'approved',
        moderationReason: moderationReason || '',
        ownerName: owner?.name || '',
        ownerEmail: owner?.email || '',
        ownerPhone: owner?.phone || '',
        ownership: record.ownerId ? 'owner-managed' : 'unclaimed'
      }
      }), total, page),
      categories: categoryNames
    })
  } catch (error) { next(error) }
})

router.patch('/businesses/:kind/:id/moderation', async (req, res, next) => {
  try {
    const Model = businessModels[req.params.kind]
    if (!Model) return res.status(404).json({ error: 'Business not found' })
    const business = await Model.findOne({ id: req.params.id }).select('approvalStatus')
    if (!business) return res.status(404).json({ error: 'Business not found' })
    const result = validateBusinessModeration({
      currentStatus: business.approvalStatus || 'legacy',
      action: req.body?.action,
      reason: req.body?.reason
    })
    if (result.status !== 200) return res.status(result.status).json({ error: result.error })
    const updated = await Model.findOneAndUpdate(
      { id: req.params.id },
      { $set: { approvalStatus: result.approvalStatus, moderationReason: result.moderationReason } },
      { new: true, runValidators: true }
    ).lean()
    if (!updated) return res.status(404).json({ error: 'Business not found' })
    res.json({
      id: updated.id,
      approvalStatus: updated.approvalStatus,
      verified: updated.approvalStatus === 'approved'
    })
  } catch (error) { next(error) }
})

router.get('/stats', async (req, res, next) => {
  try {
    const [users, listings, activeListings, soldListings, pendingReports, shops, hotels, categories, activeCategories, pendingShops, pendingHotels] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ status: { $in: ['Active', null] } }),
      Product.countDocuments({ status: 'Sold' }),
      Report.countDocuments({ status: { $in: ['Pending', 'Reviewing'] } }),
      Shop.countDocuments(),
      Hotel.countDocuments(),
      Category.countDocuments(),
      Category.countDocuments({ active: true }),
      Shop.countDocuments({ approvalStatus: 'pending' }),
      Hotel.countDocuments({ approvalStatus: 'pending' })
    ])
    res.json({
      users,
      listings,
      activeListings,
      soldListings,
      pendingReports,
      shops,
      hotels,
      pendingShops,
      pendingHotels,
      categories,
      activeCategories,
      soldProducts: soldListings,
      reports: pendingReports
    })
  } catch (error) { next(error) }
})

export default router
