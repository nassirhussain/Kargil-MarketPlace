import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

const hashCode = code => createHmac('sha256', process.env.OTP_HASH_SECRET || process.env.JWT_SECRET)
  .update(code)
  .digest('hex')

async function responseBody(response) {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || body.error || 'Verification provider request failed')
  return body
}

export async function sendEmailCode(destination, code) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('Email verification is not configured. Set RESEND_API_KEY and EMAIL_FROM.')
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [destination],
      subject: 'Your Kargil Marketplace verification code',
      text: `Your verification code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`
    })
  })
  await responseBody(response)
}

function twilioConfig() {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_VERIFY_SERVICE_SID) {
    throw new Error('Phone verification is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_VERIFY_SERVICE_SID.')
  }
  return { accountSid: TWILIO_ACCOUNT_SID, authToken: TWILIO_AUTH_TOKEN, serviceSid: TWILIO_VERIFY_SERVICE_SID }
}

async function twilioRequest(path, values) {
  const { accountSid, authToken, serviceSid } = twilioConfig()
  const response = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(values)
  })
  return responseBody(response)
}

export async function sendPhoneCode(destination) {
  await twilioRequest('Verifications', { To: destination, Channel: 'sms' })
}

export async function checkPhoneCode(destination, code) {
  const body = await twilioRequest('VerificationCheck', { To: destination, Code: code })
  return body.status === 'approved'
}

export function newEmailCode() {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  return { code, codeHash: hashCode(code) }
}

export function matchesEmailCode(code, expectedHash) {
  const actual = Buffer.from(hashCode(code), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function configuredProvider(channel) {
  if (channel === 'email') return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID)
}
