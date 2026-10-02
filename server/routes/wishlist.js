import { Router } from 'express'
import Product from '../models/Product.js'
import Wishlist from '../models/Wishlist.js'
import { isMongoReady } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Wishlist is unavailable until the marketplace database is connected.' })
    const items = await Wishlist.find({ userId: req.user.id }).sort({ updatedAt: -1 }).select('listingId').lean()
    res.json(items.map(item => item.listingId))
  } catch (error) { next(error) }
})

router.post('/', rateLimit({ limit: 60, windowMs: 10 * 60_000, keyPrefix: 'wishlist-write' }), async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Wishlist is unavailable until the marketplace database is connected.' })
    const listingId = typeof req.body.listingId === 'string' ? req.body.listingId.trim() : ''
    if (!listingId || listingId.length > 100) return res.status(400).json({ error: 'Choose a valid listing to save.' })
    const listing = await Product.findOne({ id: listingId, status: { $nin: ['Sold', 'Rejected'] } }).select('id').lean()
    if (!listing) return res.status(404).json({ error: 'This listing is no longer available to save.' })
    try {
      await Wishlist.updateOne(
        { userId: req.user.id, listingId },
        { $setOnInsert: { userId: req.user.id, listingId } },
        { upsert: true }
      )
    } catch (error) {
      if (error.code !== 11000) throw error
    }
    res.status(201).json({ listingId, saved: true })
  } catch (error) { next(error) }
})

router.delete('/:listingId', rateLimit({ limit: 60, windowMs: 10 * 60_000, keyPrefix: 'wishlist-write' }), async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Wishlist is unavailable until the marketplace database is connected.' })
    await Wishlist.deleteOne({ userId: req.user.id, listingId: req.params.listingId })
    res.json({ listingId: req.params.listingId, saved: false })
  } catch (error) { next(error) }
})

export default router
