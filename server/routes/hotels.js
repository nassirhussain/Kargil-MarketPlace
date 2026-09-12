import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
import Hotel from '../models/Hotel.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'

const router = Router()
router.get('/', async (req, res, next) => {
  try { res.json(isMongoReady() ? (await Hotel.find().lean()).map(stripMongo) : (await readStore()).hotels || []) } catch (error) { next(error) }
})
router.post('/', async (req, res, next) => {
  try {
    const hotel = { id: `hotel-${Date.now()}`, rooms: [], foods: [], ...req.body }
    if (isMongoReady()) await Hotel.create(hotel)
    else { const data = await readStore(); data.hotels = [...(data.hotels || []), hotel]; await writeStore(data) }
    res.status(201).json(hotel)
  } catch (error) { next(error) }
})
export default router
