import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import Conversation from '../models/Conversation.js'
import Product from '../models/Product.js'
import { requireAuth } from '../middleware/auth.js'
import { stripMongo } from '../lib/mongodb.js'

const router = Router()
router.use(requireAuth)

function parseMessage(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const offerAmount = body.offerAmount === '' || body.offerAmount == null ? undefined : Number(body.offerAmount)
  if (!text && offerAmount === undefined) return { error: 'Write a message or enter an offer amount' }
  if (offerAmount !== undefined && (!Number.isFinite(offerAmount) || offerAmount < 1)) return { error: 'Offer amount must be greater than zero' }
  return { text: text || 'I would like to offer this amount.', offerAmount }
}

router.get('/conversations', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      $or: [{ buyerId: req.user.id }, { sellerId: req.user.id }]
    }).sort({ updatedAt: -1 }).lean()
    res.json(conversations.map(conversation => {
      const lastReadAt = conversation.buyerId === req.user.id ? conversation.buyerLastReadAt : conversation.sellerLastReadAt
      const unreadCount = conversation.messages.filter(message =>
        message.senderId !== req.user.id && (!lastReadAt || new Date(message.createdAt) > new Date(lastReadAt))
      ).length
      return { ...stripMongo(conversation), unreadCount }
    }))
  } catch (error) { next(error) }
})

router.post('/conversations', async (req, res, next) => {
  try {
    const product = await Product.findOne({ id: req.body.productId }).lean()
    if (!product) return res.status(404).json({ error: 'This listing could not be found' })
    if (!product.sellerId) return res.status(400).json({ error: 'This listing has no registered seller account to message' })
    if (product.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot message yourself about your own listing' })
    const parsed = parseMessage(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    if (parsed.offerAmount !== undefined && parsed.offerAmount > Number(product.price)) {
      return res.status(400).json({ error: 'Your offer cannot be higher than the listed price' })
    }

    const conversation = await Conversation.findOneAndUpdate(
      { productId: product.id, buyerId: req.user.id, sellerId: product.sellerId },
      {
        $setOnInsert: {
          id: randomUUID(),
          productId: product.id,
          productTitle: product.title,
          productPrice: Number(product.price),
          productImage: product.image,
          buyerId: req.user.id,
          buyerName: req.user.name,
          sellerId: product.sellerId,
          sellerName: product.seller
        },
        $push: { messages: { senderId: req.user.id, senderName: req.user.name, ...parsed } }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean()
    res.status(201).json(stripMongo(conversation))
  } catch (error) { next(error) }
})

router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({ id: req.params.id })
    if (!conversation || ![conversation.buyerId, conversation.sellerId].includes(req.user.id)) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    const isBuyer = conversation.buyerId === req.user.id
    const lastReadAt = isBuyer ? conversation.buyerLastReadAt : conversation.sellerLastReadAt
    const hasUnread = conversation.messages.some(message =>
      message.senderId !== req.user.id && (!lastReadAt || message.createdAt > lastReadAt)
    )
    if (hasUnread) {
      if (isBuyer) conversation.buyerLastReadAt = new Date()
      else conversation.sellerLastReadAt = new Date()
      await conversation.save()
    }
    res.json(stripMongo(conversation))
  } catch (error) { next(error) }
})

router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const parsed = parseMessage(req.body)
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const conversation = await Conversation.findOne({ id: req.params.id })
    if (!conversation || ![conversation.buyerId, conversation.sellerId].includes(req.user.id)) {
      return res.status(404).json({ error: 'Conversation not found' })
    }
    if (parsed.offerAmount !== undefined && parsed.offerAmount > conversation.productPrice) {
      return res.status(400).json({ error: 'Offer cannot be higher than the listed price' })
    }
    conversation.messages.push({ senderId: req.user.id, senderName: req.user.name, ...parsed })
    await conversation.save()
    res.status(201).json(stripMongo(conversation))
  } catch (error) { next(error) }
})

export default router
