import mongoose from 'mongoose'

const shopSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: String,
  category: String,
  location: String,
  contactNumber: String,
  description: String,
  ownerId: { type: String, index: true },
  productIds: [String]
}, { strict: false, timestamps: true })

export default mongoose.models.Shop || mongoose.model('Shop', shopSchema)
