import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import health from './routes/health.js'
import shops from './routes/shops.js'
import products from './routes/products.js'
import hotels from './routes/hotels.js'
import auth from './routes/auth.js'
import User from './models/User.js'
import { requireAuth } from './middleware/auth.js'
import { connectMongo, mongoState, seedMongo } from './lib/mongodb.js'

const app = express()
const port = process.env.PORT || 3001
app.use(cors())
app.use(express.json())
app.use(passport.initialize())
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL || `http://localhost:${port}`}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase()
      if (!email) return done(new Error('Google account did not provide an email'))
      const user = await User.findOneAndUpdate(
        { $or: [{ googleId: profile.id }, { email }] },
        { $set: { googleId: profile.id, email, name: profile.displayName || email.split('@')[0], avatar: profile.photos?.[0]?.value } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      )
      done(null, user)
    } catch (error) { done(error) }
  }))
}
app.use('/api/health', health)
app.use('/api/shops', shops)
app.use('/api/products', products)
app.use('/api/hotels', hotels)
app.use('/api/auth', auth)
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }))
app.get('/', (req, res) => res.json({ service: 'Kargil Marketplace API', health: '/api/health' }))
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Unable to read marketplace data' }) })
app.listen(port, async () => {
  console.log(`Kargil Marketplace API listening on http://localhost:${port}`)
  const connected = await connectMongo()
  if (connected) {
    try {
      await seedMongo()
      console.log('Connected to MongoDB Atlas; marketplace collections are ready')
    } catch (error) {
      mongoState.status = 'error'
      mongoState.error = error.message
      console.error(`MongoDB seed failed; using JSON marketplace fallback: ${error.message}`)
    }
  } else if (mongoState.status === 'disabled') {
    console.warn('MongoDB is not configured; using JSON marketplace fallback and auth is disabled.')
  } else {
    console.error(`MongoDB connection failed; using JSON marketplace fallback and auth is disabled: ${mongoState.error}`)
  }
})
