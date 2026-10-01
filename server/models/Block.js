import mongoose from 'mongoose'

const blockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true },
  blockedId: { type: String, required: true }
}, { timestamps: true })

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true })
blockSchema.index({ blockedId: 1, createdAt: -1 })

export default mongoose.models.Block || mongoose.model('Block', blockSchema)
