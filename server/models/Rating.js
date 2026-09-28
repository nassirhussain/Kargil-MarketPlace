import mongoose from 'mongoose'

const ratingSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  sellerId: { type: String, required: true },
  reviewerId: { type: String, required: true },
  reviewerName: { type: String, required: true },
  stars: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true })

ratingSchema.index({ productId: 1, reviewerId: 1 }, { unique: true })

export default mongoose.models.Rating || mongoose.model('Rating', ratingSchema)
