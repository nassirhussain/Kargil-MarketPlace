import mongoose from 'mongoose'

const adminActionLockSchema = new mongoose.Schema({
  _id: { type: String },
  owner: { type: String },
  lockedUntil: { type: Date }
}, { versionKey: false })

export default mongoose.models.AdminActionLock || mongoose.model('AdminActionLock', adminActionLockSchema)
