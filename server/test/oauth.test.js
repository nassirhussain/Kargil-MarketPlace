import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allowedFrontendOrigins,
  consumeOAuthExchange,
  googleCallbackUrl,
  hashOAuthExchangeCode,
  isValidOAuthExchangeCode,
  matchesOAuthState,
  normalizeOrigin,
  oauthFailureCode,
  oauthFrontendCallbackUrl,
  oauthFrontendOrigin,
  oauthStateCookieOptions
} from '../lib/oauth.js'

test('Google callback URL normalizes trailing slash and optional /api path', () => {
  assert.equal(
    googleCallbackUrl({ NODE_ENV: 'production', API_URL: 'https://api.example.invalid/api/' }),
    'https://api.example.invalid/api/auth/google/callback'
  )
})

test('production OAuth URLs do not fall back to localhost', () => {
  assert.throws(() => googleCallbackUrl({ NODE_ENV: 'production' }), /API_URL must be a public URL/)
  assert.throws(() => normalizeOrigin('http://localhost:3001', 'API_URL', { production: true }), /public HTTPS URL/)
})

test('OAuth redirect destination is one normalized origin from the CORS allowlist', () => {
  const env = {
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://market.example.invalid/,https://preview.example.invalid',
    OAUTH_FRONTEND_URL: 'https://market.example.invalid/'
  }
  assert.deepEqual(allowedFrontendOrigins(env), ['https://market.example.invalid', 'https://preview.example.invalid'])
  assert.equal(oauthFrontendOrigin(env), 'https://market.example.invalid')
  assert.throws(() => oauthFrontendOrigin({ ...env, OAUTH_FRONTEND_URL: 'https://unlisted.example.invalid' }), /must exactly match/)
  assert.throws(() => normalizeOrigin('https://market.example.invalid/path', 'OAUTH_FRONTEND_URL'), /must be an origin/)
})

test('OAuth state matching and failure redirects accept only safe values', () => {
  assert.equal(matchesOAuthState('random-state', 'random-state'), true)
  assert.equal(matchesOAuthState('random-state', 'other-state'), false)
  assert.equal(matchesOAuthState('random-state', ''), false)
  assert.equal(matchesOAuthState('', 'anything'), false)
  assert.equal(oauthFailureCode('access_denied'), 'google_failed')
  assert.equal(oauthFailureCode('google_cancelled'), 'google_cancelled')
})

test('OAuth state cookie is callback-scoped and safe for the provider redirect round trip', () => {
  assert.deepEqual(oauthStateCookieOptions(true), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth/google/callback'
  })
  assert.equal(oauthStateCookieOptions(false).secure, false)
})

test('OAuth success callback sends the exchange code in the fragment, not the query', () => {
  const url = new URL(oauthFrontendCallbackUrl({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://market.example.invalid,https://preview.example.invalid',
    OAUTH_FRONTEND_URL: 'https://market.example.invalid'
  }, 'a'.repeat(43)))
  assert.equal(url.origin, 'https://market.example.invalid')
  assert.equal(url.pathname, '/auth/callback')
  assert.equal(url.search, '')
  assert.equal(new URLSearchParams(url.hash.slice(1)).get('code'), 'a'.repeat(43))
  assert.throws(() => oauthFrontendCallbackUrl({
    NODE_ENV: 'production',
    FRONTEND_URL: 'https://market.example.invalid',
    OAUTH_FRONTEND_URL: 'https://unlisted.example.invalid'
  }, 'a'.repeat(43)), /must exactly match/)
})

test('OAuth exchange rejects missing and malformed codes before looking up records', async () => {
  let lookupCount = 0
  const dependencies = {
    findOneAndDelete: async () => { lookupCount += 1; return null },
    findUserById: async () => null
  }
  assert.equal(isValidOAuthExchangeCode('a'.repeat(43)), true)
  assert.equal(isValidOAuthExchangeCode('short'), false)
  assert.equal((await consumeOAuthExchange(undefined, dependencies)).status, 400)
  assert.equal((await consumeOAuthExchange('short', dependencies)).status, 400)
  assert.equal(lookupCount, 0)
  assert.throws(() => hashOAuthExchangeCode('short'), /Invalid OAuth exchange code/)
})

test('OAuth exchange rejects expired records and consumes a valid code only once', async () => {
  const now = new Date('2026-10-09T00:00:00.000Z')
  const expiredCode = 'e'.repeat(43)
  const validCode = 'v'.repeat(43)
  const records = new Map([
    [hashOAuthExchangeCode(expiredCode), { userId: 'expired-user', expiresAt: new Date(now.getTime() - 1) }],
    [hashOAuthExchangeCode(validCode), { userId: 'active-user', expiresAt: new Date(now.getTime() + 1) }]
  ])
  const dependencies = {
    now,
    findOneAndDelete: async filter => {
      const record = records.get(filter.codeHash)
      if (!record || record.expiresAt <= filter.expiresAt.$gt) return null
      records.delete(filter.codeHash)
      return record
    },
    findUserById: async id => ({ id, status: 'active' })
  }

  assert.equal((await consumeOAuthExchange(expiredCode, dependencies)).status, 401)
  assert.equal(records.has(hashOAuthExchangeCode(expiredCode)), true)
  assert.deepEqual(await consumeOAuthExchange(validCode, dependencies), {
    status: 200,
    user: { id: 'active-user', status: 'active' }
  })
  assert.equal((await consumeOAuthExchange(validCode, dependencies)).status, 401)
})
