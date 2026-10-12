import { randomUUID } from 'node:crypto'

const safeErrorNames = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
  'ValidationError',
  'CastError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoServerError',
  'MongoParseError',
  'MongoTimeoutError',
  'JsonWebTokenError',
  'TokenExpiredError'
])
const safeConfigurationNames = new Set([
  'MONGODB_URI',
  'JWT_SECRET',
  'OTP_HASH_SECRET',
  'ADMIN_EMAILS',
  'FRONTEND_URL',
  'OAUTH_FRONTEND_URL',
  'API_URL',
  'RENDER_EXTERNAL_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_VERIFY_SERVICE_SID'
])

export function createRequestId() {
  return randomUUID()
}

export function safeErrorName(error) {
  return safeErrorNames.has(error?.name) ? error.name : 'Error'
}

export function logDiagnostic({ event, code, requestId, error, settings = [] }) {
  const record = {
    event: /^[a-z][a-z0-9.]{0,63}$/.test(event) ? event : 'server.internal',
    code: /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'INTERNAL_ERROR',
    requestId: /^[0-9a-f-]{36}$/i.test(requestId || '') ? requestId : createRequestId()
  }
  if (error) record.errorName = safeErrorName(error)
  const safeSettings = [...new Set(settings.filter(name => safeConfigurationNames.has(name)))]
  if (safeSettings.length) record.settings = safeSettings
  console.error(JSON.stringify(record))
}

export function requestDiagnostics(req, res, next) {
  const requestId = createRequestId()
  res.locals.requestId = requestId
  res.setHeader('X-Request-ID', requestId)
  next()
}

export function apiErrorHandler(error, req, res, next) {
  const path = req.originalUrl?.split('?')[0]
  const code = path === '/api/auth/google/callback'
    ? 'OAUTH_CALLBACK_FAILED'
    : path === '/api/auth/google/exchange'
      ? 'OAUTH_EXCHANGE_FAILED'
      : 'API_REQUEST_FAILED'
  logDiagnostic({
    event: 'api.request',
    code,
    requestId: res.locals.requestId,
    error
  })
  res.status(500).json({ error: 'Unable to read marketplace data', requestId: res.locals.requestId })
}
