const groups = [
  ['email OTP provider', ['RESEND_API_KEY', 'EMAIL_FROM']],
  ['SMS OTP provider', ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID']],
  ['Google OAuth provider', ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']]
]

export function validateServerEnvironment(env = process.env) {
  const production = env.NODE_ENV === 'production'
  const required = production
    ? ['MONGODB_URI', 'JWT_SECRET', 'OTP_HASH_SECRET', 'ADMIN_EMAILS', 'FRONTEND_URL']
    : []
  const missing = required.filter(name => !env[name]?.trim())
  const partialProviders = groups
    .filter(([, names]) => names.some(name => Boolean(env[name]?.trim())) && names.some(name => !env[name]?.trim()))
    .map(([provider]) => provider)
  const errors = []
  if (missing.length) errors.push(`Missing required ${production ? 'production ' : ''}environment variables: ${missing.join(', ')}.`)
  if (partialProviders.length) errors.push(`Incomplete configuration for: ${partialProviders.join(', ')}.`)
  if (env.NODE_ENV === 'production' && env.SEED_MONGO === 'true') {
    errors.push('SEED_MONGO=true is forbidden in production.')
  }
  if (production && env.GOOGLE_CLIENT_ID?.trim() && !env.API_URL?.trim() && !env.RENDER_EXTERNAL_URL?.trim()) {
    errors.push('API_URL is required for Google OAuth in production.')
  }
  return errors
}
