import { createHash, timingSafeEqual } from 'node:crypto'

export function normalizeOrigin(value, name, { allowApiPath = false, production = false } = {}) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a public URL.`)
  let url
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`)
  }
  const path = url.pathname.replace(/\/+$/, '')
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash ||
      (path && !(allowApiPath && path === '/api'))) {
    throw new Error(`${name} must be an origin${allowApiPath ? ' or an API base URL ending in /api' : ''}, without credentials, query, or fragment.`)
  }
  if (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname))) {
    throw new Error(`${name} must use a public HTTPS URL in production.`)
  }
  return url.origin
}

export function allowedFrontendOrigins(env = process.env) {
  return (env.FRONTEND_URL || '')
    .split(',')
    .map(value => normalizeOrigin(value, 'FRONTEND_URL', { production: env.NODE_ENV === 'production' }))
}

export function oauthFrontendOrigin(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const configured = env.OAUTH_FRONTEND_URL || (!production ? 'http://localhost:5173' : '')
  const origin = normalizeOrigin(configured, 'OAUTH_FRONTEND_URL', { production })
  if (!allowedFrontendOrigins(env).includes(origin)) {
    throw new Error('OAUTH_FRONTEND_URL must exactly match one of the allowed FRONTEND_URL origins.')
  }
  return origin
}

export function googleCallbackUrl(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const configured = env.API_URL || env.RENDER_EXTERNAL_URL || (!production ? `http://localhost:${env.PORT || 3001}` : '')
  const origin = normalizeOrigin(configured, 'API_URL', { allowApiPath: true, production })
  return `${origin}/api/auth/google/callback`
}

export function isValidOAuthExchangeCode(code) {
  return typeof code === 'string' && /^[A-Za-z0-9_-]{43}$/.test(code)
}

export function hashOAuthExchangeCode(code) {
  if (!isValidOAuthExchangeCode(code)) throw new Error('Invalid OAuth exchange code.')
  return createHash('sha256').update(code).digest('hex')
}

export function oauthFrontendCallbackUrl(env, code) {
  if (!isValidOAuthExchangeCode(code)) throw new Error('Invalid OAuth exchange code.')
  const destination = new URL('/auth/callback', oauthFrontendOrigin(env))
  destination.hash = new URLSearchParams({ code }).toString()
  return destination.toString()
}

export async function consumeOAuthExchange(code, { findOneAndDelete, findUserById, now = new Date() }) {
  if (!isValidOAuthExchangeCode(code)) return { status: 400 }
  const exchange = await findOneAndDelete({
    codeHash: hashOAuthExchangeCode(code),
    expiresAt: { $gt: now }
  })
  if (!exchange) return { status: 401 }
  const user = await findUserById(exchange.userId)
  return user ? { status: 200, user } : { status: 401 }
}

export function matchesOAuthState(expected, received) {
  if (typeof expected !== 'string' || typeof received !== 'string') return false
  const expectedBytes = Buffer.from(expected)
  const receivedBytes = Buffer.from(received)
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes)
}

export function oauthFailureCode(value) {
  return new Set(['google_cancelled', 'google_failed', 'oauth_unavailable', 'invalid_state', 'account_unavailable']).has(value)
    ? value
    : 'google_failed'
}

export function oauthStateCookieOptions(production = process.env.NODE_ENV === 'production') {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'lax',
    path: '/api/auth/google/callback'
  }
}
