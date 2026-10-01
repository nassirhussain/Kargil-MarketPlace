import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema({
  id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  receiverId: { type: String },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  offerAmount: { type: Number, min: 1 },
  createdAt: { type: Date, default: Date.now, index: true },
  readAt: Date
}, { _id: false })

const conversationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  productId: { type: String, required: true },
  productTitle: { type: String, required: true },
  productPrice: { type: Number, required: true },
  productImage: String,
  buyerId: { type: String, required: true },
  buyerName: { type: String, required: true },
  buyerLastReadAt: Date,
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  sellerLastReadAt: Date,
  messages: { type: [messageSchema], default: [] }
}, { timestamps: true })

conversationSchema.index({ productId: 1, buyerId: 1, sellerId: 1 }, { unique: true })
conversationSchema.index({ buyerId: 1, updatedAt: -1 })
conversationSchema.index({ sellerId: 1, updatedAt: -1 })
conversationSchema.index({ 'messages.receiverId': 1, 'messages.readAt': 1, 'messages.createdAt': -1 })

export default mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema)
