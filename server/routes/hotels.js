import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'

const router = Router()
router.get('/', async (req, res, next) => {
  try { res.json((await readStore()).hotels || []) } catch (error) { next(error) }
})
router.post('/', async (req, res, next) => {
  try {
    const data = await readStore()
    const hotel = { id: `hotel-${Date.now()}`, rooms: [], foods: [], ...req.body }
    data.hotels = [...(data.hotels || []), hotel]
    await writeStore(data)
    res.status(201).json(hotel)
  } catch (error) { next(error) }
})
export default router
