import mongoose from 'mongoose'

const productSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  shopId: String,
  title: String,
  category: String,
  price: mongoose.Schema.Types.Mixed,
  unit: String,
  description: String
}, { strict: false, timestamps: true })

export default mongoose.models.Product || mongoose.model('Product', productSchema)
