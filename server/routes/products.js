import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
import Product from '../models/Product.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
const router = Router()
router.get('/moderation/all', requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' })
    const products = isMongoReady() ? (await Product.find().lean()).map(stripMongo) : (await readStore()).products
    res.json(products)
  } catch (error) { next(error) }
})
router.get('/', async (req, res, next) => { try { const filter = { status: { $ne: 'Rejected' } }; if (req.query.shopId) filter.shopId = req.query.shopId; if (req.query.sellerId) filter.sellerId = req.query.sellerId; const products = isMongoReady() ? (await Product.find(filter).lean()).map(stripMongo) : (await readStore()).products.filter(product => product.status !== 'Rejected' && (!req.query.shopId || product.shopId === req.query.shopId) && (!req.query.sellerId || product.sellerId === req.query.sellerId)); res.json(products) } catch (e) { next(e) } })
router.get('/:id', async (req, res, next) => { try { const product = isMongoReady() ? stripMongo(await Product.findOne({ id: req.params.id, status: { $ne: 'Rejected' } }).lean()) : (await readStore()).products.find(x => x.id === req.params.id && x.status !== 'Rejected'); product ? res.json(product) : res.status(404).json({ error: 'Product not found' }) } catch (e) { next(e) } })
router.post('/', requireAuth, async (req, res, next) => { try {
  const { title, description, category, condition, location } = req.body
  const price = Number(req.body.price)
  if (typeof title !== 'string' || !title.trim() || title.length > 100 || typeof description !== 'string' || !description.trim() || description.length > 2000) return res.status(400).json({ error: 'A title and description are required' })
  if (!Number.isFinite(price) || price < 1 || typeof category !== 'string' || !category.trim() || category.length > 80 || !condition || typeof location !== 'string' || !location.trim() || location.length > 120) return res.status(400).json({ error: 'Price, category, condition, and location are required' })
  if (!req.body.image && !req.body.images?.length) return res.status(400).json({ error: 'Upload at least one product photo' })
  if (!['New', 'Used'].includes(condition)) return res.status(400).json({ error: 'Condition must be New or Used' })
  if (req.body.contactPreference !== undefined && !['chat', 'call', 'whatsapp'].includes(req.body.contactPreference)) return res.status(400).json({ error: 'Choose chat, call, or WhatsApp as your contact preference' })
  const contactPreference = req.body.contactPreference || 'chat'
  if (contactPreference !== 'chat' && (typeof req.body.contactPhone !== 'string' || !/^[+0-9 ()-]{7,20}$/.test(req.body.contactPhone.trim()))) return res.status(400).json({ error: 'Enter a valid contact number for phone or WhatsApp contact' })
  if (req.body.images && (!Array.isArray(req.body.images) || req.body.images.length > 4)) return res.status(400).json({ error: 'A listing can include up to four photos' })
  if (req.body.images?.some(image => typeof image !== 'string')) return res.status(400).json({ error: 'Each listing photo must be a valid image' })
  const point = req.body.coordinates
  if (point && (!Number.isFinite(Number(point.latitude)) || Number(point.latitude) < -90 || Number(point.latitude) > 90 || !Number.isFinite(Number(point.longitude)) || Number(point.longitude) < -180 || Number(point.longitude) > 180)) return res.status(400).json({ error: 'Precise location coordinates are invalid' })
  const product = {
    ...req.body,
    category: category.trim(),
    location: location.trim(),
    id: `product-${Date.now()}`,
    title: title.trim(),
    description: description.trim(),
    price,
    tags: Array.isArray(req.body.tags) ? req.body.tags.filter(tag => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean).slice(0, 8) : [],
    contactPreference,
    contactPhone: contactPreference === 'chat' ? '' : req.body.contactPhone.trim(),
    sellerId: req.user.id,
    seller: req.user.name,
    sellerVerified: Boolean(req.user.emailVerified || req.user.phoneVerified),
    featured: false,
    createdAt: new Date(),
    status: 'Active'
  }
  if (isMongoReady()) await Product.create(product)
  else { const data = await readStore(); data.products.push(product); await writeStore(data) }
  res.status(201).json(product)
} catch (e) { next(e) } })
router.put('/:id', requireAuth, async (req, res, next) => { try {
  const product = isMongoReady() ? await Product.findOne({ id: req.params.id }) : null
  if (isMongoReady() && !product) return res.status(404).json({ error: 'Product not found' })
  if (isMongoReady() && product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only update your own listings' })
  if (req.body.status && !['Active', 'Sold', 'Rejected'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid listing status' })
  if (req.body.status === 'Rejected' && req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required to reject listings' })
  if (req.body.featured !== undefined && (req.user.role !== 'admin' || typeof req.body.featured !== 'boolean')) return res.status(403).json({ error: 'Only admins can feature listings' })
  const allowed = ['title', 'price', 'category', 'condition', 'description', 'location', 'status', 'image', 'images', 'tags', 'contactPreference', 'contactPhone', 'featured']
  const updated = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]))
  if (isMongoReady()) {
    const updatedProduct = await Product.findOneAndUpdate({ id: req.params.id }, { $set: updated }, { new: true })
    res.json(stripMongo(updatedProduct))
  } else {
    const data = await readStore()
    const index = data.products.findIndex(item => item.id === req.params.id)
    if (index < 0) return res.status(404).json({ error: 'Product not found' })
    if (data.products[index].sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only update your own listings' })
    data.products[index] = { ...data.products[index], ...updated }
    await writeStore(data)
    res.json(data.products[index])
  }
} catch (e) { next(e) } })
router.delete('/:id', requireAuth, async (req, res, next) => { try {
  if (isMongoReady()) {
    const product = await Product.findOne({ id: req.params.id })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own listings' })
    await product.deleteOne()
  } else {
    const data = await readStore()
    const product = data.products.find(item => item.id === req.params.id)
    if (!product) return res.status(404).json({ error: 'Product not found' })
    if (product.sellerId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'You can only delete your own listings' })
    data.products = data.products.filter(item => item.id !== req.params.id)
    await writeStore(data)
  }
  res.status(204).end()
} catch (e) { next(e) } })
export default router
