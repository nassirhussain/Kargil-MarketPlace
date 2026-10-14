import mongoose from 'mongoose'
import { createRequestId, logDiagnostic } from './diagnostics.js'

export const mongoState = {
  status: 'disabled'
}

export const isMongoReady = () => mongoState.status === 'connected' && mongoose.connection.readyState === 1

export async function connectMongo(requestId = createRequestId()) {
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
    return true
  } catch (error) {
    mongoState.status = 'error'
    logDiagnostic({
      event: 'mongo.connection',
      code: 'MONGO_CONNECTION_FAILED',
      requestId,
      error
    })
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  if (mongoState.status !== 'disabled') mongoState.status = 'disconnected'
})
mongoose.connection.on('error', error => {
  mongoState.status = 'error'
  logDiagnostic({
    event: 'mongo.connection',
    code: 'MONGO_RUNTIME_ERROR',
    requestId: createRequestId(),
    error
  })
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
