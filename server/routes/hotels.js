import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import Hotel from '../models/Hotel.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import {
  businessPublicFilter,
  canManageBusiness,
  ownerBusinessFields,
  ownerUpdateStatus,
  publicBusinessFields
} from '../lib/businessModeration.js'

const router = Router()
const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim() : ''
const publicHotel = hotel => {
  const value = publicBusinessFields(stripMongo(hotel))
  delete value.ownerId
  return value
}

router.get('/', async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel listings are unavailable until the marketplace database is connected.' })
    res.json((await Hotel.find(businessPublicFilter()).sort({ createdAt: -1, _id: -1 }).lean()).map(publicHotel))
  } catch (error) { next(error) }
})

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel management requires the marketplace database.' })
    const hotels = await Hotel.find({ ownerId: req.user.id }).sort({ createdAt: -1, _id: -1 }).lean()
    res.json(hotels.map(ownerBusinessFields))
  } catch (error) { next(error) }
})

const hotelUpdates = (body, partial) => {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const updates = {}
  const textFields = { name: 120, category: 80, location: 120, contactNumber: 30, description: 1500 }
  for (const [field, maxLength] of Object.entries(textFields)) {
    if (partial && input[field] === undefined) continue
    const value = cleanText(input[field], maxLength)
    if (!value || value.length > maxLength || (field === 'contactNumber' && !/^[+0-9 ()-]{7,30}$/.test(value))) {
      return { error: 'Provide valid hotel name, category, location, description, and contact number.' }
    }
    updates[field] = value
  }
  if (!partial || input.rooms !== undefined) {
    if (!Array.isArray(input.rooms) || input.rooms.length > 30 || input.rooms.some(room =>
      !room || typeof room !== 'object' || Array.isArray(room) ||
      !cleanText(room.type, 80) || cleanText(room.type, 80).length > 80 ||
      !Number.isFinite(Number(room.price)) || Number(room.price) < 0 ||
      !Number.isInteger(Number(room.available)) || Number(room.available) < 0 || Number(room.available) > 10000
    )) return { error: 'Provide up to 30 valid room entries with a name, non-negative price, and availability.' }
    updates.rooms = input.rooms.map(room => ({
      type: cleanText(room.type, 80),
      price: Number(room.price),
      available: Number(room.available)
    }))
  }
  if (!partial || input.foods !== undefined) {
    if (!Array.isArray(input.foods) || input.foods.length > 50 || input.foods.some(food =>
      typeof food !== 'string' || !food.trim() || food.trim().length > 80
    )) return { error: 'Provide up to 50 food items, each 1 to 80 characters long.' }
    updates.foods = input.foods.map(food => food.trim())
  }
  return { updates }
}

router.post('/', requireAuth, rateLimit({ limit: 5, windowMs: 60 * 60_000, keyPrefix: 'hotel-create' }), async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel listings require the marketplace database.' })
    const { updates, error } = hotelUpdates(req.body, false)
    if (error) return res.status(400).json({ error })
    const hotel = await Hotel.create({
      id: randomUUID(),
      ownerId: req.user.id,
      ...updates,
      approvalStatus: 'pending',
      moderationReason: '',
      createdAt: new Date()
    })
    res.status(201).json(ownerBusinessFields(hotel))
  } catch (error) { next(error) }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel management requires the marketplace database.' })
    const hotel = await Hotel.findOne({ id: req.params.id })
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' })
    if (!canManageBusiness(hotel, req.user)) return res.status(403).json({ error: 'You can only update a hotel you manage.' })
    const { updates, error } = hotelUpdates(req.body, true)
    if (error) return res.status(400).json({ error })
    if (!Object.keys(updates).length) return res.status(400).json({ error: 'Provide at least one hotel detail to update.' })
    Object.assign(hotel, updates, ownerUpdateStatus(hotel))
    await hotel.save()
    res.json(ownerBusinessFields(hotel))
  } catch (error) { next(error) }
})

export default router
