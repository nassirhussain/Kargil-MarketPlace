import { Router } from 'express'
import { readStore, writeStore } from '../lib/store.js'
import Product from '../models/Product.js'
import { isMongoReady, stripMongo } from '../lib/mongodb.js'
import { requireAuth } from '../middleware/auth.js'
const router = Router()
router.get('/', async (req, res, next) => { try { const products = isMongoReady() ? (await Product.find(req.query.shopId ? { shopId: req.query.shopId } : {}).lean()).map(stripMongo) : (await readStore()).products; res.json(products) } catch (e) { next(e) } })
router.get('/:id', async (req, res, next) => { try { const product = isMongoReady() ? stripMongo(await Product.findOne({ id: req.params.id }).lean()) : (await readStore()).products.find(x => x.id === req.params.id); product ? res.json(product) : res.status(404).json({ error: 'Product not found' }) } catch (e) { next(e) } })
router.post('/', requireAuth, async (req, res, next) => { try { const product = { id: `product-${Date.now()}`, ...req.body, sellerId: req.user.id, seller: req.user.name, status: 'Active' }; if (isMongoReady()) await Product.create(product); else { const data = await readStore(); data.products.push(product); await writeStore(data) } res.status(201).json(product) } catch (e) { next(e) } })
router.put('/:id', async (req, res, next) => { try { const updated = { ...req.body, id: req.params.id }; if (isMongoReady()) { const product = await Product.findOneAndUpdate({ id: req.params.id }, { $set: updated }, { new: true }); if (!product) return res.status(404).json({ error: 'Product not found' }); res.json(stripMongo(product)) } else { const data = await readStore(); const index = data.products.findIndex(x => x.id === req.params.id); if (index < 0) return res.status(404).json({ error: 'Product not found' }); data.products[index] = { ...data.products[index], ...updated }; await writeStore(data); res.json(data.products[index]) } } catch (e) { next(e) } })
router.delete('/:id', async (req, res, next) => { try { if (isMongoReady()) await Product.deleteOne({ id: req.params.id }); else { const data = await readStore(); data.products = data.products.filter(x => x.id !== req.params.id); await writeStore(data) } res.status(204).end() } catch (e) { next(e) } })
export default router
