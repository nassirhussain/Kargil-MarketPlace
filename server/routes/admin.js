import { Router } from 'express'
import Product from '../models/Product.js'
import User from '../models/User.js'
import Report from '../models/Report.js'
import Category from '../models/Category.js'
import { requireAuth } from '../middleware/auth.js'
import { isAdmin } from '../lib/admin.js'

const router = Router()

router.get('/stats', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const [users, listings, activeListings, soldProducts, reportedListings, reports, activeCategories] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Product.countDocuments({ status: { $in: ['Active', null] } }),
      Product.countDocuments({ status: 'Sold' }),
      Report.countDocuments({ targetType: 'listing', status: { $in: ['Pending', 'Reviewing'] } }),
      Report.countDocuments({ status: { $in: ['Pending', 'Reviewing'] } }),
      Category.countDocuments({ active: true })
    ])
    res.json({ users, listings, activeListings, soldProducts, reportedListings, reports, activeCategories })
  } catch (error) { next(error) }
})

export default router
