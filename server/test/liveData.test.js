import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import products from '../routes/products.js'
import categories from '../routes/categories.js'
import hotels from '../routes/hotels.js'
import health from '../routes/health.js'
import wishlist from '../routes/wishlist.js'

test('database-backed public routes report unavailability instead of fixture data', async t => {
  const app = express()
  app.use('/api/products', products)
  app.use('/api/categories', categories)
  app.use('/api/hotels', hotels)
  app.use('/api/health', health)
  app.use('/api/wishlist', wishlist)

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  }))

  for (const route of ['products', 'categories', 'hotels', 'health']) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${route}`)
    assert.equal(response.status, 503, `${route} should fail closed without MongoDB`)
  }

  const wishlistResponse = await fetch(`http://127.0.0.1:${server.address().port}/api/wishlist`)
  assert.equal(wishlistResponse.status, 401)
})
