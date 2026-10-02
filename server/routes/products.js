import { Router } from 'express'
import Product from '../models/Product.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
import Category from '../models/Category.js'
import User from '../models/User.js'
import Shop from '../models/Shop.js'
import mongoose from 'mongoose'
const router = Router()
const validImage = image => typeof image === 'string' && image.length <= 5 * 1024 * 1024 &&
  (/^https?:\/\/\S+$/i.test(image) || /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+=*$/i.test(image))
const publicProduct = product => {
  if (!product) return product
  const value = typeof product.toObject === 'function' ? product.toObject() : { ...product }
  if (value.coordinates && Number.isFinite(Number(value.coordinates.latitude)) && Number.isFinite(Number(value.coordinates.longitude))) {
    value.approximateCoordinates = {
      latitude: Math.round(Number(value.coordinates.latitude) * 100) / 100,
      longitude: Math.round(Number(value.coordinates.longitude) * 100) / 100
    }
  }
  delete value.coordinates
  delete value.locationExact
  delete value.__v
  delete value._id
  return value
}
router.get('/moderation/all', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    if (!isMongoReady()) return res.status(503).json({ error: 'Listing moderation requires the marketplace database.' })
    res.json((await Product.find().lean()).map(stripMongo))
  } catch (error) { next(error) }
})
router.get('/', async (req, res, next) => {
  try {
    const filter = { status: { $ne: 'Rejected' } }
    if (req.query.shopId) filter.shopId = req.query.shopId
    if (req.query.sellerId) filter.sellerId = req.query.sellerId
    if (!isMongoReady()) return res.status(503).json({ error: 'Listings are unavailable until the marketplace database is connected.' })
    const suspendedSellerIds = (await User.find({ $or: [{ blocked: true }, { status: { $in: ['suspended', 'banned'] } }] }).distinct('_id')).map(String)
    filter.sellerId = { ...(filter.sellerId ? { $eq: filter.sellerId } : {}), $nin: suspendedSellerIds }
    res.json((await Product.find(filter).lean()).map(publicProduct))
  } catch (error) { next(error) }
})
router.get('/:id', async (req, res, next) => {
  try {
    let product
    if (!isMongoReady()) return res.status(503).json({ error: 'Listings are unavailable until the marketplace database is connected.' })
    const found = await Product.findOne({ id: req.params.id, status: { $ne: 'Rejected' } }).lean()
    if (found?.sellerId && mongoose.isValidObjectId(found.sellerId)) {
      const seller = await User.findById(found.sellerId).select('status blocked').lean()
      if (!seller || (!seller.blocked && (!seller.status || seller.status === 'active'))) product = publicProduct(found)
    } else product = publicProduct(found)
    return product ? res.json(product) : res.status(404).json({ error: 'Product not found' })
  } catch (error) { next(error) }
})
router.post('/', requireAuth, async (req, res, next) => { try {
  const { title, description, category, condition, location } = req.body
  const price = Number(req.body.price)
  if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof description !== 'string' || !description.trim() || description.length > 2000) return res.status(400).json({ error: 'A title and description are required' })
  if (!Number.isFinite(price) || price < 1 || typeof category !== 'string' || !category.trim() || category.length > 80 || !condition || typeof location !== 'string' || !location.trim() || location.length > 120) return res.status(400).json({ error: 'Price, category, condition, and location are required' })
  if (!req.body.image && !req.body.images?.length) return res.status(400).json({ error: 'Upload at least one product photo' })
  if (!['New', 'Used'].includes(condition)) return res.status(400).json({ error: 'Condition must be New or Used' })
  if (isMongoReady() && !await Category.exists({ name: category.trim(), active: true })) return res.status(400).json({ error: 'Choose an active marketplace category' })
  let shop
  const quantity = req.body.quantity === undefined ? undefined : Number(req.body.quantity)
  if (quantity !== undefined && (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000)) return res.status(400).json({ error: 'Quantity must be a whole number between 1 and 10,000' })
  if (req.body.shopId !== undefined) {
    if (typeof req.body.shopId !== 'string' || !req.body.shopId.trim()) return res.status(400).json({ error: 'Choose a valid local shop' })
    if (!isMongoReady()) return res.status(503).json({ error: 'Shop inventory requires the marketplace database.' })
    shop = isMongoReady() ? await Shop.findOne({ id: req.body.shopId.trim() }) : null
    if (!shop) return res.status(404).json({ error: 'Local shop not found' })
    if (shop.ownerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the shop manager can add its inventory' })
  }
  if (req.body.contactPreference !== undefined && !['chat', 'call', 'whatsapp'].includes(req.body.contactPreference)) return res.status(400).json({ error: 'Choose chat, call, or WhatsApp as your contact preference' })
  const contactPreference = req.body.contactPreference || 'chat'
  if (contactPreference !== 'chat' && (typeof req.body.contactPhone !== 'string' || !/^[+0-9 ()-]{7,20}$/.test(req.body.contactPhone.trim()))) return res.status(400).json({ error: 'Enter a valid contact number for phone or WhatsApp contact' })
  if (req.body.images && (!Array.isArray(req.body.images) || req.body.images.length > 4)) return res.status(400).json({ error: 'A listing can include up to four photos' })
  if (req.body.images?.some(image => !validImage(image))) return res.status(400).json({ error: 'Each listing photo must be a valid HTTPS or JPEG, PNG, or WebP image under 5 MB' })
  if (req.body.image !== undefined && !validImage(req.body.image)) return res.status(400).json({ error: 'Listing image must be a valid HTTPS or JPEG, PNG, or WebP image under 5 MB' })
  const point = req.body.coordinates
  if (point && (typeof point !== 'object' || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90 || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180)) return res.status(400).json({ error: 'Precise location coordinates are invalid' })
  const product = {
    ...req.body,
    ...(point ? { coordinates: { latitude: point.latitude, longitude: point.longitude } } : {}),
    category: category.trim(),
    location: shop?.location || location.trim(),
    ...(quantity !== undefined ? { quantity } : {}),
    id: `product-${Date.now()}`,
    title: title.trim(),
    description: description.trim(),
    price,
    tags: Array.isArray(req.body.tags) ? req.body.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean).slice(0, 8) : [],
    contactPreference,
    contactPhone: contactPreference === 'chat' ? '' : req.body.contactPhone.trim(),
    sellerId: req.user.id,
    seller: req.user.name,
    ...(shop ? { shopId: shop.id } : {}),
    sellerVerified: Boolean(req.user.emailVerified || req.user.phoneVerified),
    featured: false,
    createdAt: new Date(),
    status: 'Active'
  }
  if (!isMongoReady()) return res.status(503).json({ error: 'Publishing listings requires the marketplace database.' })
  await Product.create(product)
  res.status(201).json(publicProduct(product))
} catch (e) { next(e) } })
router.put('/:id', requireAuth, async (req, res, next) => { try {
  if (!isMongoReady()) return res.status(503).json({ error: 'Updating listings requires the marketplace database.' })
  const product = await Product.findOne({ id: req.params.id })
  if (!product) return res.status(404).json({ error: 'Product not found' })
  if (product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only update your own listings' })
  if (req.body.status && !['Active', 'Sold', 'Rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid listing status' })
  if (req.body.status === 'Rejected' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required to reject listings' })
  if (req.body.featured !== undefined && (req.user.role !== 'admin' || typeof req.body.featured !== 'boolean')) return res.status(403).json({ error: 'Only admins can feature listings' })
  const allowed = ['title', 'price', 'category', 'condition', 'description', 'location', 'coordinates', 'status', 'image', 'images', 'tags', 'contactPreference', 'contactPhone', 'featured']
  const updated = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
  if (updated.title !== undefined && (typeof updated.title !== 'string' || !updated.title.trim() || updated.title.trim().length > 100)) return res.status(400).json({ error: 'Title must contain 1 to 100 characters' })
  if (updated.description !== undefined && (typeof updated.description !== 'string' || !updated.description.trim() || updated.description.length > 2000)) return res.status(400).json({ error: 'Description must contain 1 to 2,000 characters' })
  if (updated.price !== undefined && (!Number.isFinite(Number(updated.price)) || Number(updated.price) < 1)) return res.status(400).json({ error: 'Price must be a positive amount' })
  if (updated.condition !== undefined && !['New', 'Used'].includes(updated.condition)) return res.status(400).json({ error: 'Condition must be New or Used' })
  if (updated.location !== undefined && (typeof updated.location !== 'string' || !updated.location.trim() || updated.location.trim().length > 120)) return res.status(400).json({ error: 'Location must contain 1 to 120 characters' })
  if (updated.status !== undefined && !['Active', 'Sold', 'Rejected'].includes(updated.status)) return res.status(400).json({ error: 'Invalid listing status' })
  if (updated.image !== undefined && !validImage(updated.image)) return res.status(400).json({ error: 'Listing image must be a valid HTTPS or JPEG, PNG, or WebP image under 5 MB' })
  if (updated.images !== undefined && (!Array.isArray(updated.images) || updated.images.length > 4 || updated.images.some(image => !validImage(image)))) return res.status(400).json({ error: 'A listing can include up to four valid HTTPS or JPEG, PNG, or WebP photos under 5 MB each' })
  if (updated.tags !== undefined && (!Array.isArray(updated.tags) || updated.tags.length > 8 || updated.tags.some(tag => typeof tag !== 'string' || tag.trim().length > 40))) return res.status(400).json({ error: 'Provide up to eight tags, each 40 characters or fewer' })
  if (updated.tags) updated.tags = updated.tags.map(tag => tag.trim()).filter(Boolean)
  if (updated.title !== undefined) updated.title = updated.title.trim()
  if (updated.description !== undefined) updated.description = updated.description.trim()
  if (updated.location !== undefined) updated.location = updated.location.trim()
  if (updated.price !== undefined) updated.price = Number(updated.price)
  if (updated.coordinates !== undefined) {
    const point = updated.coordinates
    if (point !== null && (typeof point !== 'object' || typeof point.latitude !== 'number' || !Number.isFinite(point.latitude) || point.latitude < -90 || point.latitude > 90 || typeof point.longitude !== 'number' || !Number.isFinite(point.longitude) || point.longitude < -180 || point.longitude > 180)) {
      return res.status(400).json({ error: 'Precise location coordinates are invalid' })
    }
    if (point) updated.coordinates = { latitude: point.latitude, longitude: point.longitude }
  }
  if (updated.category !== undefined && (typeof updated.category !== 'string' || !updated.category.trim() || !await Category.exists({ name: updated.category.trim(), active: true }))) return res.status(400).json({ error: 'Choose an active marketplace category' })
  if (updated.category !== undefined) updated.category = updated.category.trim()
  if (updated.contactPreference !== undefined && !['chat', 'call', 'whatsapp'].includes(updated.contactPreference)) {
    return res.status(400).json({ error: 'Choose chat, call, or WhatsApp as your contact preference' })
  }
  const contactPreference = updated.contactPreference || product?.contactPreference || 'chat'
  const contactPhone = updated.contactPhone ?? product?.contactPhone
  if (contactPreference !== 'chat' && (typeof contactPhone !== 'string' || !/^[+0-9 ()-]{7,20}$/.test(contactPhone.trim()))) {
    return res.status(400).json({ error: 'Enter a valid phone number to enable calls or WhatsApp' })
  }
  if (updated.contactPhone !== undefined) {
    if (typeof updated.contactPhone !== 'string') return res.status(400).json({ error: 'Phone number must be text' })
    updated.contactPhone = updated.contactPhone.trim()
  }
  if (updated.contactPreference === 'chat') updated.contactPhone = ''
  const updatedProduct = await Product.findOneAndUpdate({ id: req.params.id }, { $set: updated }, { new: true })
  res.json(publicProduct(updatedProduct))
} catch (e) { next(e) } })
router.delete('/:id', requireAuth, async (req, res, next) => { try {
  if (!isMongoReady()) return res.status(503).json({ error: 'Deleting listings requires the marketplace database.' })
  const product = await Product.findOne({ id: req.params.id })
  if (!product) return res.status(404).json({ error: 'Product not found' })
  if (product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own listings' })
  await product.deleteOne()
  res.status(204).end()
} catch (e) { next(e) } })
export default router
