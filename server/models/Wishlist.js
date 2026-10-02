import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  listingId: { type: String, required: true }
}, { timestamps: true })

wishlistSchema.index({ userId: 1, listingId: 1 }, { unique: true })
wishlistSchema.index({ userId: 1, updatedAt: -1 })

export default mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema)
