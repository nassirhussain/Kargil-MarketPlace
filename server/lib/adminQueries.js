const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

export function parseAdminPage(query) {
  const rawPage = query.page ?? '1'
  const rawPageSize = query.pageSize ?? String(DEFAULT_PAGE_SIZE)
  if (Array.isArray(rawPage) || Array.isArray(rawPageSize)) return null
  const page = Number(rawPage)
  const pageSize = Number(rawPageSize)
  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) return null
  const skip = (page - 1) * pageSize
  if (!Number.isSafeInteger(skip)) return null
  return { page, pageSize, skip }
}

export function paginatedResult(items, total, { page, pageSize }) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.ceil(total / pageSize)
    }
  }
}

export function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function hasInvalidAdminStrings(query, keys) {
  return keys.some(key => query[key] !== undefined && typeof query[key] !== 'string')
}

export function activeAdminFilter(env = process.env) {
  const emails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
  return {
    ...(emails.length ? { email: { $in: emails } } : { role: 'admin' }),
    blocked: { $ne: true },
    status: { $nin: ['suspended', 'banned'] }
  }
}
