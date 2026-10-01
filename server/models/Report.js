import mongoose from 'mongoose'

const reportSchema = new mongoose.Schema({
  targetType: { type: String, enum: ['listing', 'seller', 'message'], required: true },
  targetId: { type: String, required: true },
  targetName: { type: String, required: true },
  reportedUserId: { type: String, index: true },
  activeKey: { type: String, select: false },
  reporterId: { type: String, required: true },
  reason: { type: String, required: true, trim: true, maxlength: 120 },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  status: { type: String, enum: ['Pending', 'Reviewing', 'Resolved', 'Rejected'], default: 'Pending' }
}, { timestamps: true })

reportSchema.index({ activeKey: 1 }, { unique: true, sparse: true })
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1, status: 1 })
reportSchema.index({ status: 1, createdAt: -1 })
reportSchema.index({ targetType: 1, targetId: 1 })

export default mongoose.models.Report || mongoose.model('Report', reportSchema)
