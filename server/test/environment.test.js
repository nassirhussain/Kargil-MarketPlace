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

test('Google OAuth requires an API origin and a separate allowed primary frontend origin', () => {
  const config = {
    NODE_ENV: 'production',
    MONGODB_URI: 'configured',
    JWT_SECRET: 'configured',
    OTP_HASH_SECRET: 'configured',
    ADMIN_EMAILS: 'admin@example.invalid',
    FRONTEND_URL: 'https://kargil-market-place.vercel.app,https://preview.example.invalid',
    OAUTH_FRONTEND_URL: 'https://kargil-market-place.vercel.app',
    API_URL: 'https://kargil-marketplace1.onrender.com/api/',
    GOOGLE_CLIENT_ID: 'configured',
    GOOGLE_CLIENT_SECRET: 'configured'
  }
  assert.deepEqual(validateServerEnvironment(config), [])
  assert.match(validateServerEnvironment({ ...config, OAUTH_FRONTEND_URL: 'https://other.example.invalid' }).join(' '), /must exactly match/)
  assert.match(validateServerEnvironment({ ...config, API_URL: 'http://localhost:3001' }).join(' '), /public HTTPS URL/)
})
