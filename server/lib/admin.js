export function isAdmin(user) {
  const allowlist = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length) return allowlist.includes(user.email?.toLowerCase())
  return user.role === 'admin'
}
