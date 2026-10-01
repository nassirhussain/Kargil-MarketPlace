import mongoose from 'mongoose'

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  slug: { type: String, required: true, lowercase: true, trim: true, unique: true },
  icon: { type: String, default: 'Package', maxlength: 40 },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true }
}, { timestamps: true })

categorySchema.index({ active: 1, order: 1 })
categorySchema.index({ name: 1 }, { unique: true })

export default mongoose.models.Category || mongoose.model('Category', categorySchema)
