import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['listing', 'seller'], required: true },
  targetId: { type: String, required: true },
  targetName: { type: String, required: true },
  reporterId: { type: String, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending' }
}, { timestamps: true })

reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 })

export default mongoose.models.Report || mongoose.model('Report', reportSchema)
