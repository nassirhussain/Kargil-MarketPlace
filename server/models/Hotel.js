import mongoose from 'mongoose'

const hotelSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  ownerId: { type: String, required: true, index: true },
  name: String,
  category: String,
  location: String,
  contactNumber: String,
  description: String,
  rooms: { type: [mongoose.Schema.Types.Mixed], default: [] },
  foods: { type: [String], default: [] },
  approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'suspended'] },
  moderationReason: { type: String, maxlength: 500 },
  createdAt: { type: Date, immutable: true }
}, { strict: false, timestamps: false })

export default mongoose.models.Hotel || mongoose.model('Hotel', hotelSchema)
