import test from 'node:test'
import assert from 'node:assert/strict'
import { apiErrorHandler, createRequestId, logDiagnostic, requestDiagnostics, safeErrorName } from '../lib/diagnostics.js'

test('diagnostics retain safe categories, error names, and correlation IDs without raw error data', () => {
  const requestId = createRequestId()
  const sensitiveValues = [
    'access-token-value',
    'jwt-value',
    'oauth-code-value',
    'oauth-state-value',
    'client-secret-value',
    'mongodb://private-user:private-password@db.example.invalid/private-db',
    'cookie-value',
    'authorization-header-value',
    '?code=private-query-value'
  ]
  const error = new Error(sensitiveValues.join(' '))
  error.name = 'MongoServerError'
  const records = []
  const originalError = console.error
  console.error = line => records.push(JSON.parse(line))

  try {
    logDiagnostic({ event: 'oauth.flow', code: 'OAUTH_PROVIDER_FAILED', requestId, error })
  } finally {
    console.error = originalError
  }

  assert.deepEqual(records, [{
    event: 'oauth.flow',
    code: 'OAUTH_PROVIDER_FAILED',
    requestId,
    errorName: 'MongoServerError'
  }])
  const output = JSON.stringify(records)
  for (const value of sensitiveValues) assert.equal(output.includes(value), false)
})

test('diagnostics replace unrecognized error names and malformed metadata with safe values', () => {
  const error = new Error('private details')
  error.name = 'secret-value'
  assert.equal(safeErrorName(error), 'Error')

  const records = []
  const originalError = console.error
  console.error = line => records.push(JSON.parse(line))
  try {
    logDiagnostic({ event: 'private event', code: 'private-code', requestId: 'private-id', error })
  } finally {
    console.error = originalError
  }
  assert.equal(records[0].event, 'server.internal')
  assert.equal(records[0].code, 'INTERNAL_ERROR')
  assert.match(records[0].requestId, /^[0-9a-f-]{36}$/i)
  assert.equal(records[0].errorName, 'Error')
})

test('configuration diagnostics report only recognized variable names, never values', () => {
  const records = []
  const originalError = console.error
  console.error = line => records.push(JSON.parse(line))
  try {
    logDiagnostic({
      event: 'server.startup',
      code: 'CONFIGURATION_INVALID',
      requestId: createRequestId(),
      settings: ['MONGODB_URI', 'JWT_SECRET', 'secret-value']
    })
  } finally {
    console.error = originalError
  }
  assert.deepEqual(records[0].settings, ['MONGODB_URI', 'JWT_SECRET'])
  assert.equal(JSON.stringify(records).includes('secret-value'), false)
})

test('request diagnostics issue a correlation ID without trusting request headers', () => {
  const headers = {}
  const response = { locals: {}, setHeader: (name, value) => { headers[name] = value } }
  let continued = false
  requestDiagnostics({ headers: { 'x-request-id': 'attacker-controlled' } }, response, () => { continued = true })

  assert.equal(continued, true)
  assert.match(response.locals.requestId, /^[0-9a-f-]{36}$/i)
  assert.equal(headers['X-Request-ID'], response.locals.requestId)
  assert.notEqual(headers['X-Request-ID'], 'attacker-controlled')
})

test('API error handler returns generic details and logs safe classification with request ID', () => {
  const requestId = createRequestId()
  const secrets = 'mongodb://private-user:private-password@db.invalid/private?token=hidden'
  const originalError = new Error(secrets)
  originalError.name = 'MongooseServerSelectionError'
  const records = []
  const originalLog = console.error
  console.error = line => records.push(JSON.parse(line))
  let statusCode
  let payload
  try {
    apiErrorHandler(
      originalError,
      { originalUrl: '/api/auth/google/exchange?code=private-code' },
      {
        locals: { requestId },
        status(code) { statusCode = code; return this },
        json(value) { payload = value }
      },
      () => assert.fail('The error handler must send a response')
    )
  } finally {
    console.error = originalLog
  }
  assert.equal(statusCode, 500)
  assert.deepEqual(payload, { error: 'Unable to read marketplace data', requestId })
  assert.deepEqual(records, [{
    event: 'api.request',
    code: 'OAUTH_EXCHANGE_FAILED',
    requestId,
    errorName: 'MongooseServerSelectionError'
  }])
  const output = JSON.stringify({ records, payload })
  for (const secret of [secrets, 'private-code', 'private-password', 'token=hidden']) {
    assert.equal(output.includes(secret), false)
  }
})
