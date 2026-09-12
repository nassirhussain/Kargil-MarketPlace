import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

async function seedModel(Model, records) {
  if (await Model.countDocuments() > 0) return
  await Model.bulkWrite(records.map(record => ({
    updateOne: { filter: { id: record.id }, update: { $setOnInsert: record }, upsert: true }
  })))
}

export async function seedMongo() {
  if (!isMongoReady()) return
  const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data.json')
  const data = JSON.parse(await fs.readFile(dataPath, 'utf8'))
  const [{ default: Shop }, { default: Product }, { default: Hotel }] = await Promise.all([
    import('../models/Shop.js'), import('../models/Product.js'), import('../models/Hotel.js')
  ])
  await Promise.all([
    seedModel(Shop, data.shops || []),
    seedModel(Product, data.products || []),
    seedModel(Hotel, data.hotels || [])
  ])
}
