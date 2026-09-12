import { Router } from 'express'
import { mongoState } from '../lib/mongodb.js'
const router = Router()
router.get('/', (req, res) => res.json({ status: 'ok', service: 'kargil-marketplace-api', mongo: { status: mongoState.status, error: mongoState.error } }))
export default router
