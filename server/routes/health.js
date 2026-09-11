import { Router } from 'express'
const router = Router()
router.get('/', (req, res) => res.json({ status: 'ok', service: 'kargil-marketplace-api' }))
export default router
