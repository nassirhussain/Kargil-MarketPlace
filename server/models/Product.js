import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  shopId: String,
  title: String,
  category: String,
  price: mongoose.Schema.Types.Mixed,
  quantity: { type: Number, min: 1 },
  unit: String,
  description: String
}, { strict: false, timestamps: true })

productSchema.index({ category: 1, status: 1, createdAt: -1 })
productSchema.index({ location: 1, status: 1 })
productSchema.index({ 'coordinates.latitude': 1, 'coordinates.longitude': 1 })

export default mongoose.models.Product || mongoose.model('Product', productSchema)
