import { Router } from 'express'
import { isMongoReady, mongoState } from '../lib/mongodb.js'
const router = Router()
router.get('/', (req, res) => {
  const ready = isMongoReady()
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ok' : 'unavailable',
    service: 'kargil-marketplace-api',
    mongo: { status: mongoState.status, error: mongoState.error }
  })
})
export default router
