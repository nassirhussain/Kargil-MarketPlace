import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import Hotel from '../models/Hotel.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
const cleanText = (value, maxLength) => typeof value === 'string' ? value.trim() : ''
const publicHotel = hotel => {
  const value = stripMongo(hotel)
  delete value.ownerId
  return value
}

router.get('/', async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel listings are unavailable until the marketplace database is connected.' })
    res.json((await Hotel.find().lean()).map(publicHotel))
  } catch (error) { next(error) }
})
router.post('/', requireAuth, rateLimit({ limit: 5, windowMs: 60 * 60_000, keyPrefix: 'hotel-create' }), async (req, res, next) => {
  try {
    if (!isMongoReady()) return res.status(503).json({ error: 'Hotel listings require the marketplace database.' })

    const name = cleanText(req.body.name, 120)
    const category = cleanText(req.body.category, 80)
    const location = cleanText(req.body.location, 120)
    const contactNumber = cleanText(req.body.contactNumber, 30)
    const description = cleanText(req.body.description, 1500)
    const rooms = req.body.rooms
    const foods = req.body.foods
    if (!name || name.length > 120 || !category || category.length > 80 || !location || location.length > 120 ||
      !description || description.length > 1500 || !/^[+0-9 ()-]{7,30}$/.test(contactNumber)) {
      return res.status(400).json({ error: 'Provide a valid hotel name, category, location, description, and contact number.' })
    }
    if (!Array.isArray(rooms) || rooms.length > 30 || rooms.some(room =>
      !room || typeof room !== 'object' || Array.isArray(room) ||
      !cleanText(room.type, 80) || cleanText(room.type, 80).length > 80 ||
      !Number.isFinite(Number(room.price)) || Number(room.price) < 0 ||
      !Number.isInteger(Number(room.available)) || Number(room.available) < 0 || Number(room.available) > 10000
    )) {
      return res.status(400).json({ error: 'Provide up to 30 valid room entries with a name, non-negative price, and availability.' })
    }
    if (!Array.isArray(foods) || foods.length > 50 || foods.some(food =>
      typeof food !== 'string' || !food.trim() || food.trim().length > 80
    )) {
      return res.status(400).json({ error: 'Provide up to 50 food items, each 1 to 80 characters long.' })
    }

    const hotel = await Hotel.create({
      id: randomUUID(),
      ownerId: req.user.id,
      name,
      category,
      location,
      contactNumber,
      description,
      rooms: rooms.map(room => ({
        type: cleanText(room.type, 80),
        price: Number(room.price),
        available: Number(room.available)
      })),
      foods: foods.map(food => food.trim())
    })
    res.status(201).json(publicHotel(hotel))
  } catch (error) { next(error) }
})
export default router
