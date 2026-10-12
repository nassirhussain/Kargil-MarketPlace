import test from 'node:test'
import assert from 'node:assert/strict'
import { activeAdminFilter, escapeRegex, hasInvalidAdminStrings, paginatedResult, parseAdminPage } from '../lib/adminQueries.js'
import { updateAdminTargetStatus } from '../lib/adminStatus.js'
import {
  businessPublicFilter,
  canManageBusiness,
  isBusinessPublic,
  ownerBusinessFields,
  ownerUpdateStatus,
  publicBusinessFields,
  validateBusinessModeration,
  validateBusinessText
} from '../lib/businessModeration.js'
import { requireAdmin } from '../middleware/admin.js'
import Shop from '../models/Shop.js'
import Hotel from '../models/Hotel.js'

test('admin pagination validates limits and returns consistent result metadata', () => {
  assert.deepEqual(parseAdminPage({}), { page: 1, pageSize: 25, skip: 0 })
  assert.deepEqual(parseAdminPage({ page: '3', pageSize: '10' }), { page: 3, pageSize: 10, skip: 20 })
  assert.equal(parseAdminPage({ page: '0' }), null)
  assert.equal(parseAdminPage({ page: '9007199254740992' }), null)
  assert.equal(parseAdminPage({ pageSize: '101' }), null)
  assert.equal(parseAdminPage({ page: ['1', '2'] }), null)
  assert.equal(hasInvalidAdminStrings({ status: ['active', 'banned'] }, ['status']), true)
  assert.equal(hasInvalidAdminStrings({ status: 'active' }, ['status']), false)
  assert.deepEqual(paginatedResult(['item'], 11, { page: 2, pageSize: 10 }), {
    items: ['item'],
    pagination: { page: 2, pageSize: 10, total: 11, pages: 2 }
  })
})

test('admin search escapes regular expression input and active-admin queries exclude disabled accounts', () => {
  assert.equal(escapeRegex('book (used)+'), 'book \\(used\\)\\+')
  assert.deepEqual(activeAdminFilter({ ADMIN_EMAILS: 'admin@example.invalid, second@example.invalid' }), {
    email: { $in: ['admin@example.invalid', 'second@example.invalid'] },
    blocked: { $ne: true },
    status: { $nin: ['suspended', 'banned'] }
  })
})

test('admin middleware denies users without admin access', () => {
  let status
  let body
  const response = {
    status(value) { status = value; return this },
    json(value) { body = value; return this }
  }
  let continued = false
  requireAdmin({ user: { role: 'user' } }, response, () => { continued = true })
  assert.equal(status, 403)
  assert.deepEqual(body, { error: 'Admin access required' })
  assert.equal(continued, false)
})

const makeStatusDependencies = overrides => ({
  actorId: 'admin-1',
  targetId: 'target-1',
  status: 'banned',
  findUser: async () => ({ status: 'active', blocked: false, email: 'admin@example.invalid' }),
  isAdmin: () => true,
  countActiveAdmins: async () => 2,
  acquireLock: async () => true,
  releaseLock: async () => {},
  updateUser: async (id, status) => ({ status: 200, body: { id, status } }),
  ...overrides
})

test('admin status changes reject invalid input, missing targets, and self-disable attempts', async () => {
  assert.deepEqual(await updateAdminTargetStatus(makeStatusDependencies({ status: 'promote' })), {
    status: 400,
    error: 'Choose active, suspended, or banned status'
  })
  assert.deepEqual(await updateAdminTargetStatus(makeStatusDependencies({ actorId: 'target-1' })), {
    status: 400,
    error: 'You cannot suspend your own account'
  })
  assert.deepEqual(await updateAdminTargetStatus(makeStatusDependencies({ findUser: async () => null })), {
    status: 404,
    error: 'User not found'
  })
})

test('admin status changes protect the last active administrator and release the lock', async () => {
  let released = false
  let updated = false
  const result = await updateAdminTargetStatus(makeStatusDependencies({
    countActiveAdmins: async () => 1,
    releaseLock: async () => { released = true },
    updateUser: async () => { updated = true }
  }))
  assert.deepEqual(result, {
    status: 409,
    error: 'The last active administrator cannot be suspended or banned.'
  })
  assert.equal(released, true)
  assert.equal(updated, false)
})

test('admin status changes persist when another active administrator remains', async () => {
  let released = false
  const result = await updateAdminTargetStatus(makeStatusDependencies({
    releaseLock: async () => { released = true }
  }))
  assert.deepEqual(result, { status: 200, body: { id: 'target-1', status: 'banned' } })
  assert.equal(released, true)
})

test('admin status changes return conflict when the administrator lock is held', async () => {
  let checkedCount = false
  const result = await updateAdminTargetStatus(makeStatusDependencies({
    acquireLock: async () => false,
    countActiveAdmins: async () => { checkedCount = true; return 2 }
  }))
  assert.deepEqual(result, {
    status: 409,
    error: 'Another administrator change is in progress. Try again.'
  })
  assert.equal(checkedCount, false)
})

test('legacy businesses stay public and do not receive an unearned verified badge', () => {
  const legacy = { id: 'legacy-business', name: 'Legacy store', moderationReason: 'private note' }
  assert.deepEqual(businessPublicFilter(), {
    $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }]
  })
  assert.equal(isBusinessPublic(legacy), true)
  assert.equal(isBusinessPublic({ ...legacy, approvalStatus: 'approved' }), true)
  assert.equal(isBusinessPublic({ ...legacy, approvalStatus: 'pending' }), false)
  assert.equal(isBusinessPublic({ ...legacy, approvalStatus: 'rejected' }), false)
  assert.equal(isBusinessPublic({ ...legacy, approvalStatus: 'suspended' }), false)
  assert.deepEqual(publicBusinessFields(legacy), {
    id: 'legacy-business',
    name: 'Legacy store',
    verified: false,
    approvalStatus: 'legacy'
  })
})

test('business owners can be identified without granting ownership to legacy records', () => {
  assert.equal(canManageBusiness({ ownerId: 'user-1' }, { id: 'user-1' }), true)
  assert.equal(canManageBusiness({ ownerId: 'user-1' }, { id: 'user-2' }), false)
  assert.equal(canManageBusiness({ id: 'legacy-business' }, { id: 'user-1' }), false)
  assert.deepEqual(validateBusinessText(
    ['name', 'category'],
    { name: 'Updated store', category: 'Books', ownerId: 'attacker', approvalStatus: 'approved', verified: true },
    { name: 120, category: 80 }
  ), { updates: { name: 'Updated store', category: 'Books' } })
  assert.deepEqual(validateBusinessText(
    ['contactNumber'],
    { contactNumber: '' },
    { contactNumber: 30 },
    ['contactNumber']
  ), { updates: { contactNumber: '' } })
  assert.deepEqual(ownerUpdateStatus({ approvalStatus: 'rejected', moderationReason: 'Fix details' }), {
    approvalStatus: 'pending',
    moderationReason: ''
  })
  assert.deepEqual(ownerUpdateStatus({ approvalStatus: 'approved' }), {})
})

test('owners see rejection reasons while public business data never exposes moderation notes', () => {
  const rejected = { id: 'shop-1', approvalStatus: 'rejected', moderationReason: 'Add a valid contact number.' }
  assert.deepEqual(ownerBusinessFields(rejected), {
    id: 'shop-1',
    approvalStatus: 'rejected',
    verified: false,
    rejectionReason: 'Add a valid contact number.'
  })
  assert.deepEqual(publicBusinessFields(rejected), {
    id: 'shop-1',
    approvalStatus: 'rejected',
    verified: false
  })
  assert.equal(ownerBusinessFields({ ...rejected, approvalStatus: 'suspended' }).rejectionReason, undefined)
})

test('business moderation validates required reasons and every supported state transition', () => {
  const transitions = [
    ['pending', 'approve', 'approved'],
    ['pending', 'reject', 'rejected'],
    ['approved', 'reject', 'rejected'],
    ['approved', 'suspend', 'suspended'],
    ['rejected', 'approve', 'approved'],
    ['suspended', 'restore', 'approved'],
    ['legacy', 'approve', 'approved'],
    ['legacy', 'reject', 'rejected'],
    ['legacy', 'suspend', 'suspended']
  ]
  for (const [currentStatus, action, expected] of transitions) {
    const result = validateBusinessModeration({
      currentStatus,
      action,
      reason: ['reject', 'suspend'].includes(action) ? 'Needs a correction' : ''
    })
    assert.equal(result.status, 200, `${currentStatus} -> ${action}`)
    assert.equal(result.approvalStatus, expected)
  }
  assert.equal(validateBusinessModeration({ currentStatus: 'pending', action: 'reject', reason: '' }).status, 400)
  assert.equal(validateBusinessModeration({ currentStatus: 'approved', action: 'suspend', reason: 'bad' }).status, 400)
  assert.equal(validateBusinessModeration({ currentStatus: 'pending', action: 'restore', reason: '' }).status, 409)
  assert.equal(validateBusinessModeration({ currentStatus: 'approved', action: 'promote', reason: '' }).status, 400)
})

test('shop and hotel schemas constrain approval states without defaulting legacy records to pending', async () => {
  for (const Model of [Shop, Hotel]) {
    await new Model({ id: 'status-valid', ownerId: 'owner-1', approvalStatus: 'pending' }).validate()
    await assert.rejects(
      new Model({ id: 'status-invalid', ownerId: 'owner-1', approvalStatus: 'public' }).validate(),
      error => Boolean(error.errors.approvalStatus)
    )
    const legacy = new Model({ id: 'status-legacy', ownerId: 'owner-1' })
    assert.equal(legacy.approvalStatus, undefined)
    await legacy.validate()
  }
})
