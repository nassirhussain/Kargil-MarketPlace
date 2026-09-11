import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
const router = Router()
router.get('/', async (req, res, next) => { try { const products = (await readStore()).products; res.json(req.query.shopId ? products.filter(x => x.shopId === req.query.shopId) : products) } catch (e) { next(e) } })
router.get('/:id', async (req, res, next) => { try { const product = (await readStore()).products.find(x => x.id === req.params.id); product ? res.json(product) : res.status(404).json({ error: 'Product not found' }) } catch (e) { next(e) } })
router.post('/', async (req, res, next) => { try { const data = await readStore(); const product = { id: `product-${Date.now()}`, ...req.body }; data.products.push(product); await writeStore(data); res.status(201).json(product) } catch (e) { next(e) } })
router.put('/:id', async (req, res, next) => { try { const data = await readStore(); const index = data.products.findIndex(x => x.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Product not found' }); data.products[index] = { ...data.products[index], ...req.body, id: req.params.id }; await writeStore(data); res.json(data.products[index]) } catch (e) { next(e) } })
router.delete('/:id', async (req, res, next) => { try { const data = await readStore(); data.products = data.products.filter(x => x.id !== req.params.id); await writeStore(data); res.status(204).end() } catch (e) { next(e) } })
export default router
