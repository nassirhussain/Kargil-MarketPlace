import test from 'node:test'
import assert from 'node:assert/strict'
import { validateServerEnvironment } from '../lib/environment.js'

test('production startup requires database and secret configuration', () => {
  assert.match(
    validateServerEnvironment({ NODE_ENV: 'production' }).join(' '),
    /MONGODB_URI, JWT_SECRET, OTP_HASH_SECRET, ADMIN_EMAILS, FRONTEND_URL/
  )
})

test('production refuses sample seeding and partial provider settings', () => {
  const errors = validateServerEnvironment({
    NODE_ENV: 'production',
    MONGODB_URI: 'configured',
    JWT_SECRET: 'configured',
    OTP_HASH_SECRET: 'configured',
    ADMIN_EMAILS: 'admin@example.invalid',
    FRONTEND_URL: 'https://market.example.invalid',
    SEED_MONGO: 'true',
    RESEND_API_KEY: 'configured'
  })
  assert.match(errors.join(' '), /SEED_MONGO=true is forbidden/)
  assert.match(errors.join(' '), /Incomplete configuration for: email OTP provider/)
})

test('development can run without production-only providers', () => {
  assert.deepEqual(validateServerEnvironment({ NODE_ENV: 'development' }), [])
})
