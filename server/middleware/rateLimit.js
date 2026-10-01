const windows = new Map()

export function rateLimit({ limit, windowMs, keyPrefix }) {
  return (req, res, next) => {
    const now = Date.now()
    const key = `${keyPrefix}:${req.user?.id || req.ip}`
    let entry = windows.get(key)
    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs }
      windows.set(key, entry)
    }
    entry.count += 1
    if (entry.count > limit) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return res.status(429).json({ error: 'Too many requests. Please try again later.' })
    }
    if (windows.size > 10_000) {
      for (const [storedKey, storedValue] of windows) if (now >= storedValue.resetAt) windows.delete(storedKey)
    }
    next()
  }
}
