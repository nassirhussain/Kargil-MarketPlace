import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import Conversation from '../models/Conversation.js'
import Product from '../models/Product.js'
import Block from '../models/Block.js'
import { requireAuth } from '../middleware/auth.js'
import { stripMongo } from '../lib/mongodb.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
router.use(requireAuth)
router.use(rateLimit({ limit: 40, windowMs: 10 * 60_000, keyPrefix: 'messages' }))
const accountsBlocked = async (firstId, secondId) => Boolean(await Block.exists({
  $or: [{ blockerId: firstId, blockedId: secondId }, { blockerId: secondId, blockedId: firstId }]
}))

function parseMessage(body) {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const offerAmount = body.offerAmount === '' || body.offerAmount == null ? undefined : Number(body.offerAmount)
  if (!text && offerAmount === undefined) return { error: 'Write a message or enter an offer amount' }
  if (text.length > 2000) return { error: 'Messages must be 2,000 characters or fewer' }
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
        (message.receiverId === req.user.id || (!message.receiverId && message.senderId !== req.user.id)) &&
        !message.readAt && (!lastReadAt || new Date(message.createdAt) > new Date(lastReadAt))
      ).length
      const lastMessage = conversation.messages.at(-1)
      return {
        ...stripMongo(conversation),
        unreadCount,
        lastMessagePreview: lastMessage?.text || (lastMessage?.offerAmount ? `Offer: ₹${lastMessage.offerAmount}` : ''),
        lastMessageAt: lastMessage?.createdAt || conversation.updatedAt
      }
    }))
  } catch (error) { next(error) }
})

router.post('/conversations', async (req, res, next) => {
  try {
    if (typeof req.body.productId !== 'string' || !req.body.productId.trim() || req.body.productId.length > 100) {
      return res.status(400).json({ error: 'Choose a valid listing to start this conversation' })
    }
    const product = await Product.findOne({ id: req.body.productId }).lean()
    if (!product) return res.status(404).json({ error: 'This listing could not be found' })
    if (product.status === 'Rejected' || product.status === 'Sold') return res.status(400).json({ error: 'This listing is no longer available for messaging' })
    if (!product.sellerId) return res.status(400).json({ error: 'This listing has no registered seller account to message' })
    if (product.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot message yourself about your own listing' })
    if (await accountsBlocked(req.user.id, product.sellerId)) return res.status(403).json({ error: 'Messaging is unavailable because one account has blocked the other' })
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
        $push: { messages: { senderId: req.user.id, senderName: req.user.name, receiverId: product.sellerId, ...parsed } }
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
    const otherUserId = conversation.buyerId === req.user.id ? conversation.sellerId : conversation.buyerId
    if (await accountsBlocked(req.user.id, otherUserId)) return res.status(403).json({ error: 'This conversation is unavailable because one account has blocked the other' })
    const isBuyer = conversation.buyerId === req.user.id
    const lastReadAt = isBuyer ? conversation.buyerLastReadAt : conversation.sellerLastReadAt
    const now = new Date()
    const hasUnread = conversation.messages.some(message =>
      !message.readAt && (
        message.receiverId === req.user.id ||
        (!message.receiverId && message.senderId !== req.user.id && (!lastReadAt || message.createdAt > lastReadAt))
      )
    )
    if (hasUnread) {
      conversation.messages.forEach(message => {
        if (!message.readAt && (
          message.receiverId === req.user.id ||
          (!message.receiverId && message.senderId !== req.user.id && (!lastReadAt || message.createdAt > lastReadAt))
        )) {
          message.receiverId = req.user.id
          message.readAt = now
        }
      })
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
    const receiverId = conversation.buyerId === req.user.id ? conversation.sellerId : conversation.buyerId
    if (await accountsBlocked(req.user.id, receiverId)) return res.status(403).json({ error: 'Messaging is unavailable because one account has blocked the other' })
    if (parsed.offerAmount !== undefined && parsed.offerAmount > conversation.productPrice) {
      return res.status(400).json({ error: 'Offer cannot be higher than the listed price' })
    }
    conversation.messages.push({ senderId: req.user.id, senderName: req.user.name, receiverId, ...parsed })
    await conversation.save()
    res.status(201).json(stripMongo(conversation))
  } catch (error) { next(error) }
})

export default router
