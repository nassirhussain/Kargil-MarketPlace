import mongoose from 'mongoose'

const verificationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  channel: { type: String, enum: ['email', 'phone'], required: true },
  destination: { type: String, required: true },
  codeHash: { type: String, select: false },
  provider: { type: String, enum: ['resend', 'twilio'], required: true },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  purgeAt: { type: Date, required: true },
  windowStartedAt: { type: Date, required: true },
  requestCount: { type: Number, default: 1 },
  attempts: { type: Number, default: 0 }
}, { timestamps: true })

verificationSchema.index({ userId: 1, channel: 1 }, { unique: true })
verificationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 })
verificationSchema.index({ destination: 1, sentAt: -1 })

export default mongoose.models.Verification || mongoose.model('Verification', verificationSchema)
