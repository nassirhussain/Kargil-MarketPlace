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
import messages from './routes/messages.js'
import ratings from './routes/ratings.js'
import reports from './routes/reports.js'
import users from './routes/users.js'
import categories from './routes/categories.js'
import admin from './routes/admin.js'
import wishlist from './routes/wishlist.js'
import User from './models/User.js'
import { requireAuth } from './middleware/auth.js'
import { connectMongo, mongoState, seedMongo } from './lib/mongodb.js'
import { validateServerEnvironment } from './lib/environment.js'

const app = express()
const port = process.env.PORT || 3001
app.set('trust proxy', 1)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim().replace(/\/$/, ''))
  .filter(Boolean)
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) }))
app.use(express.json({ limit: '8mb' }))
app.use(passport.initialize())
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.API_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`}/api/auth/google/callback`
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value?.toLowerCase()
      if (!email) return done(new Error('Google account did not provide an email'))
      let user = await User.findOne({ $or: [{ googleId: profile.id }, { email }] })
      if (!user) {
        user = await User.create({ googleId: profile.id, email, name: profile.displayName || email.split('@')[0], avatar: profile.photos?.[0]?.value })
      } else {
        user.googleId = profile.id
        user.avatar = profile.photos?.[0]?.value || user.avatar
        await user.save()
      }
      if ((user.status && user.status !== 'active') || user.blocked) return done(null, false, { message: 'This account is not active' })
      if (profile._json?.email_verified === true && !user.emailVerified) {
        user.emailVerified = true
        await user.save()
      }
      done(null, user)
    } catch (error) { done(error) }
  }))
}
app.use('/api/health', health)
app.use('/api/shops', shops)
app.use('/api/products', products)
app.use('/api/hotels', hotels)
app.use('/api/auth', auth)
app.use('/api/messages', messages)
app.use('/api/ratings', ratings)
app.use('/api/reports', reports)
app.use('/api/users', users)
app.use('/api/categories', categories)
app.use('/api/admin', admin)
app.use('/api/wishlist', wishlist)
app.get('/api/me', requireAuth, (req, res) => res.json({ user: req.user }))
app.get('/', (req, res) => res.json({ service: 'Kargil Marketplace API', health: '/api/health' }))
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Unable to read marketplace data' }) })
async function start() {
  const environmentErrors = validateServerEnvironment()
  if (environmentErrors.length) throw new Error(environmentErrors.join(' '))
  const connected = await connectMongo()
  if (connected) {
    try {
      await seedMongo()
      console.log('Connected to MongoDB Atlas; marketplace collections are ready')
    } catch (error) {
      mongoState.status = 'error'
      mongoState.error = error.message
      throw new Error(`MongoDB initialization failed: ${error.message}`)
    }
  } else if (mongoState.status === 'disabled') {
    if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI is required in production.')
    console.warn('MongoDB is not configured; database-backed API routes will return 503.')
  } else {
    if (process.env.NODE_ENV === 'production') throw new Error(`MongoDB connection failed: ${mongoState.error}`)
    console.error(`MongoDB connection failed; database-backed API routes will return 503: ${mongoState.error}`)
  }
  app.listen(port, () => console.log(`Kargil Marketplace API listening on http://localhost:${port}`))
}
start().catch(error => {
  console.error(`Unable to start Kargil Marketplace API: ${error.message}`)
  process.exitCode = 1
})
