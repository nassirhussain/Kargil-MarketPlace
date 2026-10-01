import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import passport from 'passport'
import User from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { isMongoReady } from '../lib/mongodb.js'
import Verification from '../models/Verification.js'
import { checkPhoneCode, configuredProvider, matchesEmailCode, newEmailCode, sendEmailCode, sendPhoneCode } from '../lib/verificationProviders.js'
import { isAdmin } from '../lib/admin.js'
import { rateLimit } from '../middleware/rateLimit.js'

const router = Router()
const configured = () => Boolean(process.env.JWT_SECRET && isMongoReady())
const normalizePhone = value => typeof value === 'string' ? value.trim().replace(/[ ()-]/g, '') : undefined
const accountStatus = user => user.blocked
  ? (user.status === 'suspended' ? 'suspended' : 'banned')
  : (user.status || 'active')
const publicUser = user => ({ id: user.id, email: user.email, name: user.name, phone: user.phone, college: user.college, area: user.area, location: user.location, avatar: user.avatar, emailVerified: Boolean(user.emailVerified), phoneVerified: Boolean(user.phoneVerified), role: isAdmin(user) ? 'admin' : 'user', status: accountStatus(user) })
const tokenFor = user => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })
const unavailable = (req, res, next) => configured() ? next() : res.status(503).json({ error: 'Authentication is not configured. Set MONGODB_URI and JWT_SECRET.' })

router.post('/signup', rateLimit({ limit: 8, windowMs: 60 * 60_000, keyPrefix: 'signup' }), unavailable, async (req, res, next) => {
  try {
    const { email, password, name, phone, college, area, location } = req.body
    if (typeof password !== 'string' || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name and password are required' })
    if (email !== undefined && email !== null && typeof email !== 'string') return res.status(400).json({ error: 'Email must be text' })
    if (phone !== undefined && phone !== null && typeof phone !== 'string') return res.status(400).json({ error: 'Phone number must be text' })
    if (password.length < 8 || password.length > 128) return res.status(400).json({ error: 'Password must be between 8 and 128 characters' })
    if (name.trim().length > 100) return res.status(400).json({ error: 'Name must be 100 characters or fewer' })
    const normalizedEmail = email?.trim().toLowerCase() || undefined
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(400).json({ error: 'Enter a valid email address' })
    const normalizedPhone = normalizePhone(phone) || undefined
    if (!normalizedEmail && !normalizedPhone) return res.status(400).json({ error: 'Provide an email address or phone number' })
    if (normalizedPhone && !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) return res.status(400).json({ error: 'Enter a phone number in international format, such as +919876543210' })
    if (normalizedEmail && await User.findOne({ email: normalizedEmail })) return res.status(409).json({ error: 'Email is already registered' })
    if (normalizedPhone && await User.findOne({ phone: normalizedPhone })) return res.status(409).json({ error: 'Phone number is already registered' })
    const user = await User.create({ email: normalizedEmail, password: await bcrypt.hash(password, 12), name: name.trim(), phone: normalizedPhone, college, area, location })
    res.status(201).json({ token: tokenFor(user), user: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/login', rateLimit({ limit: 10, windowMs: 15 * 60_000, keyPrefix: 'login' }), unavailable, async (req, res, next) => {
  try {
    const { email, phone, password } = req.body
    if (typeof password !== 'string' || (email !== undefined && typeof email !== 'string') || (phone !== undefined && typeof phone !== 'string')) {
      return res.status(400).json({ error: 'Enter a valid email or phone and password' })
    }
    const identifier = (email || phone || '').trim()
    if (!identifier) return res.status(400).json({ error: 'Enter an email or phone number' })
    const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: identifier }
    const user = await User.findOne(query).select('+password')
    if (!user || !user.password || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ error: 'Invalid email or password' })
    if (accountStatus(user) !== 'active') return res.status(403).json({ error: `This account is ${accountStatus(user)}. Contact support if you believe this is a mistake.` })
    res.json({ token: tokenFor(user), user: publicUser(user) })
  } catch (error) { next(error) }
})
router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))
router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, phone, college, area, location } = req.body
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' })
    const normalizedPhone = normalizePhone(phone)
    if (name.trim().length > 100 || (phone && (!normalizedPhone || !/^\+[1-9]\d{7,14}$/.test(normalizedPhone)))) return res.status(400).json({ error: 'Enter a valid name and phone number in international format' })
    if (normalizedPhone && normalizedPhone !== req.user.phone && await User.findOne({ phone: normalizedPhone, _id: { $ne: req.user.id } })) return res.status(409).json({ error: 'Phone number is already registered' })
    const phoneChanged = Boolean(normalizedPhone && normalizedPhone !== req.user.phone)
    const user = await User.findByIdAndUpdate(req.user.id, {
      $set: { name: name.trim(), ...(normalizedPhone ? { phone: normalizedPhone } : {}), college: typeof college === 'string' ? college.trim() : '', area: typeof area === 'string' ? area.trim() : '', location: typeof location === 'string' ? location.trim() : '', ...(phoneChanged ? { phoneVerified: false } : {}) }
    }, { new: true, runValidators: true })
    if (phoneChanged) await Verification.deleteOne({ userId: req.user.id, channel: 'phone' })
    res.json({ user: publicUser(user) })
  } catch (error) { next(error) }
})

router.post('/verification/request', requireAuth, rateLimit({ limit: 8, windowMs: 60 * 60_000, keyPrefix: 'otp-request' }), async (req, res, next) => {
  try {
    const channel = req.body.channel
    if (!['email', 'phone'].includes(channel)) return res.status(400).json({ error: 'Choose email or phone verification' })
    const destination = channel === 'email' ? req.user.email : req.user.phone
    if (!destination) return res.status(400).json({ error: `Add an ${channel} address to your profile before requesting verification` })
    const alreadyVerified = channel === 'email' ? req.user.emailVerified : req.user.phoneVerified
    if (alreadyVerified) return res.status(409).json({ error: `${channel} is already verified` })
    if (!configuredProvider(channel)) return res.status(503).json({ error: channel === 'email' ? 'Email OTP is unavailable. Configure RESEND_API_KEY and EMAIL_FROM.' : 'Phone OTP is unavailable. Configure the Twilio Verify environment variables.' })
    const now = new Date()
    const existing = await Verification.findOne({ userId: req.user.id, channel })
    if (existing && now - existing.sentAt < 60_000) {
      return res.status(429).json({ error: 'Wait before requesting another code', retryAfterSeconds: Math.ceil((60_000 - (now - existing.sentAt)) / 1000) })
    }
    const windowStartedAt = existing?.windowStartedAt || now
    const requestCount = existing && now - windowStartedAt < 24 * 60 * 60 * 1000 ? existing.requestCount : 0
    if (requestCount >= 6) return res.status(429).json({ error: 'Too many verification codes requested. Try again tomorrow.' })
    let codeHash
    let emailCode
    if (channel === 'email') {
      const generated = newEmailCode()
      emailCode = generated.code
      codeHash = generated.codeHash
    }
    try {
      await Verification.findOneAndUpdate(
        {
          userId: req.user.id,
          channel,
          $or: [{ sentAt: { $lte: new Date(now.getTime() - 60_000) } }, { sentAt: { $exists: false } }]
        },
        { $set: { destination, provider: channel === 'email' ? 'resend' : 'twilio', sentAt: now, expiresAt: new Date(now.getTime() + 10 * 60_000), purgeAt: new Date(now.getTime() + 24 * 60 * 60_000), windowStartedAt: requestCount ? windowStartedAt : now, requestCount: requestCount + 1, attempts: 0, ...(codeHash ? { codeHash } : {}) } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    } catch (error) {
      if (error.code === 11000) return res.status(429).json({ error: 'Wait before requesting another code', retryAfterSeconds: 60 })
      throw error
    }
    if (channel === 'email') await sendEmailCode(destination, emailCode)
    else await sendPhoneCode(destination)
    res.json({ message: `A verification code was sent to your ${channel}`, expiresInSeconds: 600, resendAfterSeconds: 60 })
  } catch (error) { next(error) }
})

router.post('/verification/confirm', requireAuth, rateLimit({ limit: 10, windowMs: 15 * 60_000, keyPrefix: 'otp-confirm' }), async (req, res, next) => {
  try {
    const { channel, code } = req.body
    if (!['email', 'phone'].includes(channel) || typeof code !== 'string' || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Enter the six-digit verification code' })
    const record = await Verification.findOne({ userId: req.user.id, channel }).select('+codeHash')
    if (!record || record.expiresAt <= new Date()) return res.status(400).json({ error: 'Verification code expired. Request a new code.' })
    const currentDestination = channel === 'email' ? req.user.email : req.user.phone
    if (!currentDestination || record.destination !== currentDestination) {
      await Verification.deleteOne({ _id: record._id })
      return res.status(400).json({ error: `The ${channel} address changed. Request a new code.` })
    }
    if (record.attempts >= 5) return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' })
    const matches = channel === 'email'
      ? Boolean(record.codeHash && matchesEmailCode(code, record.codeHash))
      : await checkPhoneCode(record.destination, code)
    if (!matches) {
      const attempt = await Verification.updateOne({ _id: record._id, attempts: { $lt: 5 } }, { $inc: { attempts: 1 } })
      if (!attempt.modifiedCount) return res.status(429).json({ error: 'Too many incorrect attempts. Request a new code.' })
      return res.status(400).json({ error: 'Incorrect verification code' })
    }
    const field = channel === 'email' ? 'emailVerified' : 'phoneVerified'
    const user = await User.findByIdAndUpdate(req.user.id, { $set: { [field]: true } }, { new: true })
    await Verification.deleteOne({ _id: record._id })
    res.json({ message: `${channel} verified successfully`, user: publicUser(user) })
  } catch (error) { next(error) }
})

router.get('/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).json({ error: 'Google OAuth is not configured' })
  if (!configured()) return unavailable(req, res, next)
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })(req, res, next)
})

router.get('/google/callback', unavailable, passport.authenticate('google', { session: false, failureRedirect: '/api/auth/google/failure' }), (req, res) => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  res.redirect(`${frontend.replace(/\/$/, '')}/auth/callback?token=${encodeURIComponent(tokenFor(req.user))}`)
})
router.get('/google/failure', (req, res) => res.status(401).json({ error: 'Google authentication failed' }))
export default router
