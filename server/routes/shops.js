import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import Shop from '../models/Shop.js'
import Product from '../models/Product.js'
import User from '../models/User.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
import {
  businessPublicFilter,
  canManageBusiness,
  ownerBusinessFields,
  ownerUpdateStatus,
  publicBusinessFields,
  validateBusinessText
} from '../lib/businessModeration.js'

const router = Router()
const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
const canManage = (shop, user) => canManageBusiness(shop, user) || user.role === 'admin'
const publicShop = shop => ({ ...publicBusinessFields(stripMongo(shop)), products: shop.products || [] })
const publicProduct = product => {
  const value = stripMongo(product)
  if (value.coordinates && Number.isFinite(Number(value.coordinates.latitude)) && Number.isFinite(Number(value.coordinates.longitude))) {
    value.approximateCoordinates = {
      latitude: Math.round(Number(value.coordinates.latitude) * 100) / 100,
      longitude: Math.round(Number(value.coordinates.longitude) * 100) / 100
    }
  }
  delete value.coordinates
  delete value.locationExact
  return value
}

router.get('/', async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Local shops are unavailable until the database is connected.' })
    const suspendedSellerIds = (await User.find({
      $or: [{ blocked: true }, { status: { $in: ['suspended', 'banned'] } }]
    }).distinct('_id')).map(String)
    const shops = await Shop.find({
      ownerId: { $nin: suspendedSellerIds },
      ...businessPublicFilter()
    }).sort({ name: 1 }).lean()
    const products = await Product.find({
      $or: [
        { shopId: { $in: shops.map(shop => shop.id) } },
        { id: { $in: shops.flatMap(shop => shop.productIds || []) } }
      ],
      status: { $nin: ['Sold', 'Rejected'] },
      sellerId: { $nin: suspendedSellerIds }
    }).lean()
    const productsByShop = new Map()
    for (const shop of shops) {
      productsByShop.set(shop.id, products.filter(product =>
        product.shopId === shop.id || (shop.productIds || []).includes(product.id)
      ).map(publicProduct))
    }
    res.json(shops.map(shop => publicShop({ ...shop, products: productsByShop.get(shop.id) || [] })))
  } catch (error) { next(error) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Shop management requires the marketplace database.' })
    const shops = await Shop.find({ ownerId: req.user.id }).sort({ createdAt: -1, _id: -1 }).lean()
    res.json(shops.map(ownerBusinessFields))
  } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Local shops are unavailable until the database is connected.' })
    const shop = await Shop.findOne({ id: req.params.id, ...businessPublicFilter() }).lean()
    if (!shop) return res.status(404).json({ error: 'Shop not found' })
    const suspendedSellerIds = (await User.find({
      $or: [{ blocked: true }, { status: { $in: ['suspended', 'banned'] } }]
    }).distinct('_id')).map(String)
    if (suspendedSellerIds.includes(shop.ownerId)) return res.status(404).json({ error: 'Shop not found' })
    const products = await Product.find({
      $or: [{ shopId: shop.id }, { id: { $in: shop.productIds || [] } }],
      status: { $nin: ['Sold', 'Rejected'] },
      sellerId: { $nin: suspendedSellerIds }
    }).sort({ createdAt: -1 }).lean()
    res.json(publicShop({ ...shop, products: products.map(publicProduct) }))
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Shop registration requires the marketplace database. Please try again later.' })
    const body = req.body || {}
    const name = cleanText(body.name, 120)
    const category = cleanText(body.category, 80)
    const location = cleanText(body.location, 120)
    const description = cleanText(body.description, 1000)
    const contactNumber = cleanText(body.contactNumber, 30)
    if (!name || !category || !location || !description) return res.status(400).json({ error: 'Shop name, category, location, and description are required.' })
    if (contactNumber && !/^[+0-9 ()-]{7,30}$/.test(contactNumber)) return res.status(400).json({ error: 'Enter a valid shop contact number.' })
    const shop = await Shop.create({
      id: randomUUID(),
      name,
      category,
      location,
      description,
      contactNumber,
      ownerId: req.user.id,
      productIds: [],
      approvalStatus: 'pending',
      moderationReason: ''
    })
    res.status(201).json(ownerBusinessFields(shop))
  } catch (error) { next(error) }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Shop management requires the marketplace database.' })
    const shop = await Shop.findOne({ id: req.params.id })
    if (!shop) return res.status(404).json({ error: 'Shop not found' })
    if (!canManage(shop, req.user)) return res.status(403).json({ error: 'You can only update a shop you manage.' })
    const { updates, error } = validateBusinessText(
      ['name', 'category', 'location', 'description', 'contactNumber'],
      req.body || {},
      { name: 120, category: 80, location: 120, description: 1000, contactNumber: 30 },
      ['contactNumber']
    )
    if (error) return res.status(400).json({ error })
    if (updates.contactNumber && !/^[+0-9 ()-]{7,30}$/.test(updates.contactNumber)) return res.status(400).json({ error: 'Enter a valid shop contact number.' })
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Provide at least one shop detail to update.' })
    Object.assign(shop, updates)
    if (canManageBusiness(shop, req.user)) Object.assign(shop, ownerUpdateStatus(shop))
    await shop.save()
    res.json(ownerBusinessFields(shop))
  } catch (error) { next(error) }
})

export default router
