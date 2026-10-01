import mongoose from 'mongoose'

const followSchema = new mongoose.Schema({
  followerId: { type: String, required: true },
  sellerId: { type: String, required: true }
}, { timestamps: true })

followSchema.index({ followerId: 1, sellerId: 1 }, { unique: true })
followSchema.index({ sellerId: 1, createdAt: -1 })

export default mongoose.models.Follow || mongoose.model('Follow', followSchema)
