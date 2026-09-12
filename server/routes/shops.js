import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
import Shop from '../models/Shop.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
const router = Router()
router.get('/', async (req, res, next) => { try { res.json(isMongoReady() ? (await Shop.find().lean()).map(stripMongo) : (await readStore()).shops) } catch (e) { next(e) } })
router.get('/:id', async (req, res, next) => { try { const shop = isMongoReady() ? stripMongo(await Shop.findOne({ id: req.params.id }).lean()) : (await readStore()).shops.find(x => x.id === req.params.id); shop ? res.json(shop) : res.status(404).json({ error: 'Shop not found' }) } catch (e) { next(e) } })
router.post('/', async (req, res, next) => { try { const shop = { id: `shop-${Date.now()}`, productIds: [], ...req.body }; if (isMongoReady()) await Shop.create(shop); else { const data = await readStore(); data.shops.push(shop); await writeStore(data) } res.status(201).json(shop) } catch (e) { next(e) } })
router.put('/:id', async (req, res, next) => { try { const updated = { ...req.body, id: req.params.id }; if (isMongoReady()) { const shop = await Shop.findOneAndUpdate({ id: req.params.id }, { $set: updated }, { new: true }); if (!shop) return res.status(404).json({ error: 'Shop not found' }); res.json(stripMongo(shop)) } else { const data = await readStore(); const index = data.shops.findIndex(x => x.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Shop not found' }); data.shops[index] = { ...data.shops[index], ...updated }; await writeStore(data); res.json(data.shops[index]) } } catch (e) { next(e) } })
router.delete('/:id', async (req, res, next) => { try { if (isMongoReady()) await Shop.deleteOne({ id: req.params.id }); else { const data = await readStore(); data.shops = data.shops.filter(x => x.id !== req.params.id); await writeStore(data) } res.status(204).end() } catch (e) { next(e) } })
export default router
