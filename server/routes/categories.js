import { Router } from 'express'
import Category from '../models/Category.js'
import mongoose from 'mongoose'
import { requireAuth } from '../middleware/auth.js'
import { isAdmin } from '../lib/admin.js'
import { defaultCategories } from '../lib/defaultCategories.js'

const router = Router()
const slugFor = name => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

router.get('/', async (req, res, next) => {
  try {
    const categories = await Category.find({ active: true }).sort({ order: 1, name: 1 }).lean()
    res.json(categories.length ? categories : defaultCategories)
  } catch (error) { next(error) }
})

router.get('/admin', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const categories = await Category.find().sort({ order: 1, name: 1 }).lean()
    res.json(categories)
  } catch (error) { next(error) }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const icon = typeof req.body.icon === 'string' ? req.body.icon.trim() : 'Package'
    if (!name || name.length > 80 || icon.length > 40) return res.status(400).json({ error: 'Enter a category name (up to 80 characters) and a valid icon name' })
    const category = await Category.create({ name, slug: slugFor(name), icon, order: Number.isInteger(req.body.order) ? req.body.order : 0, active: true })
    res.status(201).json(category)
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A category with that name already exists' })
    next(error)
  }
})

router.put('/reorder', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    if (!Array.isArray(req.body.ids) || req.body.ids.length > 100 || req.body.ids.some(id => typeof id !== 'string' || !mongoose.isValidObjectId(id)) || new Set(req.body.ids).size !== req.body.ids.length) {
      return res.status(400).json({ error: 'Provide unique valid category IDs in the intended order' })
    }
    await Promise.all(req.body.ids.map((id, order) => Category.updateOne({ _id: id }, { $set: { order } })))
    res.json(await Category.find().sort({ order: 1, name: 1 }).lean())
  } catch (error) { next(error) }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const updates = {}
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || !req.body.name.trim() || req.body.name.trim().length > 80) return res.status(400).json({ error: 'Enter a category name up to 80 characters' })
      updates.name = req.body.name.trim()
      updates.slug = slugFor(updates.name)
    }
    if (req.body.icon !== undefined) {
      if (typeof req.body.icon !== 'string' || req.body.icon.length > 40) return res.status(400).json({ error: 'Enter an icon name up to 40 characters' })
      updates.icon = req.body.icon.trim()
    }
    if (req.body.active !== undefined) {
      if (typeof req.body.active !== 'boolean') return res.status(400).json({ error: 'Category active must be true or false' })
      updates.active = req.body.active
    }
    if (req.body.order !== undefined) {
      if (!Number.isInteger(req.body.order) || req.body.order < 0) return res.status(400).json({ error: 'Category order must be a non-negative integer' })
      updates.order = req.body.order
    }
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true })
    if (!category) return res.status(404).json({ error: 'Category not found' })
    res.json(category)
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ error: 'A category with that name already exists' })
    next(error)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required' })
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true })
    if (!category) return res.status(404).json({ error: 'Category not found' })
    res.json({ id: String(category._id), active: false, message: 'Category deactivated. Existing listings remain unchanged.' })
  } catch (error) { next(error) }
})

export default router
