import test from 'node:test'
import assert from 'node:assert/strict'
import { configuredProvider, matchesEmailCode, newEmailCode } from '../lib/verificationProviders.js'
import { defaultCategories } from '../lib/defaultCategories.js'
import { rateLimit } from '../middleware/rateLimit.js'

test('email codes are six digits and only match their keyed hash', () => {
  const original = process.env.OTP_HASH_SECRET
  process.env.OTP_HASH_SECRET = 'test-key-not-for-production'
  try {
    const { code, codeHash } = newEmailCode()
    assert.match(code, /^\d{6}$/)
    assert.equal(matchesEmailCode(code, codeHash), true)
    assert.equal(matchesEmailCode('000000', codeHash), code === '000000')
  } finally {
    if (original === undefined) delete process.env.OTP_HASH_SECRET
    else process.env.OTP_HASH_SECRET = original
  }
})

test('provider readiness checks require server-side credentials', () => {
  const names = ['RESEND_API_KEY', 'EMAIL_FROM', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']
  const original = Object.fromEntries(names.map(name => [name, process.env[name]]))
  for (const name of names) delete process.env[name]
  try {
    assert.equal(configuredProvider('email'), false)
    assert.equal(configuredProvider('phone'), false)
    process.env.RESEND_API_KEY = 'test'
    process.env.EMAIL_FROM = 'test@example.invalid'
    assert.equal(configuredProvider('email'), true)
    process.env.TWILIO_ACCOUNT_SID = 'test'
    process.env.TWILIO_AUTH_TOKEN = 'test'
    process.env.TWILIO_VERIFY_SERVICE_SID = 'test'
    assert.equal(configuredProvider('phone'), true)
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name]
      else process.env[name] = original[name]
    }
  }
})

test('default database categories have stable unique slugs and order', () => {
  const names = defaultCategories.map(category => category.name)
  const slugs = defaultCategories.map(category => category.slug)
  assert.equal(names.length, 13)
  assert.equal(new Set(slugs).size, slugs.length)
  assert.deepEqual(defaultCategories.map(category => category.order), names.map((_, index) => index))
})

test('API rate limiter returns 429 after its request budget is exhausted', () => {
  const middleware = rateLimit({ limit: 1, windowMs: 60_000, keyPrefix: 'unit-test' })
  const req = { ip: `test-${Date.now()}` }
  const makeResponse = () => ({
    statusCode: 200,
    status(code) { this.statusCode = code; return this },
    set() { return this },
    json(body) { this.body = body; return this }
  })
  const firstResponse = makeResponse()
  let passed = false
  middleware(req, firstResponse, () => { passed = true })
  assert.equal(passed, true)
  const secondResponse = makeResponse()
  middleware(req, secondResponse, () => { passed = true })
  assert.equal(secondResponse.statusCode, 429)
  assert.match(secondResponse.body.error, /Too many requests/)
})
