import mongoose from 'mongoose'

const shopSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: String,
  category: String,
  location: String,
  contactNumber: String,
  description: String,
  productIds: [String]
}, { strict: false, timestamps: false })

export default mongoose.models.Shop || mongoose.model('Shop', shopSchema)
