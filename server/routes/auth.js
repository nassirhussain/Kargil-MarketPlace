import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()
const configured = () => Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)
const publicUser = user => ({ id: user.id, email: user.email, name: user.name, phone: user.phone, college: user.college, area: user.area, location: user.location, avatar: user.avatar, role: user.role })
const tokenFor = user => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
const unavailable = (req, res, next) => configured() ? next() : res.status(503).json({ error: 'Authentication is not configured. Set MONGODB_URI and JWT_SECRET.' })

router.post('/signup', unavailable, async (req, res, next) => {
  try {
    const { email, password, name, phone, college, area, location } = req.body
    if (!password || !name || (!email && !phone)) return res.status(400).json({ error: 'Name, password, and email or phone are required' })
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
    if (email && await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: 'Email is already registered' })
    const user = await User.create({ email, password: await bcrypt.hash(password, 12), name, phone, college, area, location })
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/login', unavailable, async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email: email?.toLowerCase() }).select('+password')
    if (!user || !user.password || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ error: 'Invalid email or password' })
    res.json({ token: tokenFor(user), user: publicUser(user) })
  } catch (error) { next(error) }
})
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

router.get('/google', unavailable, (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: 'Google OAuth is not configured' })
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

router.get('/google/callback', unavailable, passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }), (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  res.redirect(`${frontend.replace(/\/$/, '')}/auth/callback?token=${encodeURIComponent(tokenFor(req.user))}`)
})
router.get('/google/failure', (req, res) => res.status(401).json({ error: 'Google authentication failed' }))
export default router
