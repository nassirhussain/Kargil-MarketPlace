import { Router } from 'express'
import Conversation from '../models/Conversation.js'
import Product from '../models/Product.js'
import Rating from '../models/Rating.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.get('/:sellerId', async (req, res, next) => {
  try {
    const [summary] = await Rating.aggregate([
      { $match: { sellerId: req.params.sellerId } },
      { $group: { _id: '$sellerId', average: { $avg: '$stars' }, count: { $sum: 1 } } }
    ])
    res.json({ average: summary?.average || 0, count: summary?.count || 0 })
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.body.productId }).lean()
    const stars = Number(req.body.stars)
    const comment = typeof req.body.comment === 'string' ? req.body.comment.trim() : ''
    if (!product?.sellerId) return res.status(404).json({ error: 'Seller listing not found' })
    if (product.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot rate your own listing' })
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: 'Choose a rating from 1 to 5 stars' })
    if (comment.length > 500) return res.status(400).json({ error: 'Review must be 500 characters or fewer' })

    const conversation = await Conversation.exists({
      productId: product.id,
      buyerId: req.user.id,
      sellerId: product.sellerId
    })
    if (!conversation) return res.status(403).json({ error: 'Contact the seller about this item before leaving a rating' })

    await Rating.findOneAndUpdate(
      { productId: product.id, reviewerId: req.user.id },
      { $set: { sellerId: product.sellerId, reviewerName: req.user.name, stars, comment } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    )
    const [summary] = await Rating.aggregate([
      { $match: { sellerId: product.sellerId } },
      { $group: { _id: '$sellerId', average: { $avg: '$stars' }, count: { $sum: 1 } } }
    ])
    res.json({ average: summary?.average || 0, count: summary?.count || 0 })
  } catch (error) { next(error) }
})

export default router
