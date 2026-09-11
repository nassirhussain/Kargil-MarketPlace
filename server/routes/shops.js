import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
const router = Router()
router.get('/', async (req, res, next) => { try { res.json((await readStore()).shops) } catch (e) { next(e) } })
router.get('/:id', async (req, res, next) => { try { const shop = (await readStore()).shops.find(x => x.id === req.params.id); shop ? res.json(shop) : res.status(404).json({ error: 'Shop not found' }) } catch (e) { next(e) } })
router.post('/', async (req, res, next) => { try { const data = await readStore(); const shop = { id: `shop-${Date.now()}`, productIds: [], ...req.body }; data.shops.push(shop); await writeStore(data); res.status(201).json(shop) } catch (e) { next(e) } })
router.put('/:id', async (req, res, next) => { try { const data = await readStore(); const index = data.shops.findIndex(x => x.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Shop not found' }); data.shops[index] = { ...data.shops[index], ...req.body, id: req.params.id }; await writeStore(data); res.json(data.shops[index]) } catch (e) { next(e) } })
router.delete('/:id', async (req, res, next) => { try { const data = await readStore(); data.shops = data.shops.filter(x => x.id !== req.params.id); await writeStore(data); res.status(204).end() } catch (e) { next(e) } })
export default router
