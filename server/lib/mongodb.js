import mongoose from 'mongoose'

export const mongoState = {
  status: 'disabled',
  error: null
}

export const isMongoReady = () => mongoState.status === 'connected' && mongoose.connection.readyState === 1

export async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    mongoState.status = 'disabled'
    return false
  }
  mongoState.status = 'connecting'
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000)
    })
    mongoState.status = 'connected'
    mongoState.error = null
    return true
  } catch (error) {
    mongoState.status = 'error'
    mongoState.error = error.message
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  if (mongoState.status !== 'disabled') mongoState.status = 'disconnected'
})
mongoose.connection.on('error', error => {
  mongoState.status = 'error'
  mongoState.error = error.message
})

export function stripMongo(document) {
  if (!document) return document
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document }
  delete value._id
  delete value.__v
  return value
}

export async function seedMongo() {
  if (!isMongoReady()) return

  const { defaultCategories } = await import('./defaultCategories.js')
  const { default: Category } = await import('../models/Category.js')

  await Promise.all(defaultCategories.map(category => Category.updateOne({ slug: category.slug }, { $setOnInsert: category }, { upsert: true })))
}
