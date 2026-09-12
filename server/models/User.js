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
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true })

export default mongoose.models.User || mongoose.model('User', userSchema)
