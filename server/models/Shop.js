import mongoose from 'mongoose'

const shopSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: String,
  category: String,
  location: String,
  contactNumber: String,
  description: String,
  ownerId: { type: String, index: true },
  productIds: [String],
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'] },
  moderationReason: { type: String, maxlength: 500 }
}, { strict: false, timestamps: true })

export default mongoose.models.Shop || mongoose.model('Shop', shopSchema)
