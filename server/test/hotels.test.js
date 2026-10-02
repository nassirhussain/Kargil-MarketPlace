import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import hotels from '../routes/hotels.js'

test('creating a hotel requires an authenticated account', async t => {
  const app = express()
  app.use(express.json())
  app.use('/api/hotels', hotels)

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve())
  }))

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/hotels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Untrusted submission' })
  })

  assert.equal(response.status, 401)
  assert.deepEqual(await response.json(), { error: 'Authentication required' })
})
