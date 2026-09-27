import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  offerAmount: { type: Number, min: 1 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  productTitle: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productImage: String,
  buyerId: { type: String, required: true },
  buyerName: { type: String, required: true },
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  messages: { type: [messageSchema], default: [] }
}, { timestamps: true })

conversationSchema.index({ productId: 1, buyerId: 1, sellerId: 1 }, { unique: true })

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)
