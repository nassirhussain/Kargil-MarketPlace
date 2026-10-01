import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
  password: { type: String, select: false },
  googleId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true },
  phone: String,
  college: String,
  area: String,
  location: String,
  avatar: String,
  emailVerified: { type: Boolean, default: false },
  phoneVerified: { type: Boolean, default: false },
  blocked: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'suspended', 'banned'], default: 'active', index: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true })

userSchema.virtual('effectiveRole').get(function () {
  const allowlist = (process.env.ADMIN_EMAILS || '').split(',').map(email => email.trim().toLowerCase()).filter(Boolean)
  if (allowlist.length) return allowlist.includes(this.email?.toLowerCase()) ? 'admin' : 'user'
  return this.role
})

userSchema.index({ phone: 1 })

export default mongoose.models.User || mongoose.model('User', userSchema)
