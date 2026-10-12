const ACTION_STATUSES = {
  approve: 'approved',
  reject: 'rejected',
  suspend: 'suspended',
  restore: 'approved'
}

export function businessStatusFilter(status) {
  if (status === 'legacy') return { approvalStatus: { $exists: false } }
  return status === 'all' ? {} : { approvalStatus: status }
}

export function isBusinessPublic(business) {
  return business.approvalStatus === undefined || business.approvalStatus === 'approved'
}

export function businessPublicFilter() {
  return { $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }] }
}

export function publicBusinessFields(business) {
  const value = typeof business.toObject === 'function' ? business.toObject() : { ...business }
  delete value._id
  delete value.__v
  delete value.moderationReason
  delete value.rejectionReason
  value.verified = business.approvalStatus === 'approved'
  value.approvalStatus = business.approvalStatus || 'legacy'
  return value
}

export function ownerBusinessFields(business) {
  const value = publicBusinessFields(business)
  if (business.approvalStatus === 'rejected') value.rejectionReason = business.moderationReason || ''
  else delete value.rejectionReason
  return value
}

export function validateBusinessModeration({ currentStatus, action, reason }) {
  if (!Object.hasOwn(ACTION_STATUSES, action)) {
    return { status: 400, error: 'Choose approve, reject, suspend, or restore.' }
  }
  const transitions = {
    pending: ['approve', 'reject'],
    approved: ['reject', 'suspend'],
    rejected: ['approve'],
    suspended: ['restore'],
    legacy: ['approve', 'reject', 'suspend']
  }
  if (!transitions[currentStatus]?.includes(action)) {
    return { status: 409, error: 'That moderation action is not available for this business status.' }
  }
  const normalizedReason = typeof reason === 'string' ? reason.trim() : ''
  if (['reject', 'suspend'].includes(action) && (normalizedReason.length < 5 || normalizedReason.length > 500)) {
    return { status: 400, error: 'A review reason between 5 and 500 characters is required.' }
  }
  return {
    status: 200,
    approvalStatus: ACTION_STATUSES[action],
    moderationReason: action === 'reject' || action === 'suspend' ? normalizedReason : ''
  }
}

export function canManageBusiness(business, user) {
  return Boolean(user && business.ownerId && String(business.ownerId) === String(user.id))
}

export function ownerUpdateStatus(business) {
  return business.approvalStatus === 'rejected'
    ? { approvalStatus: 'pending', moderationReason: '' }
    : {}
}

export function validateBusinessText(fields, body, limits, optionalFields = []) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const updates = {}
  for (const field of fields) {
    if (input[field] === undefined) continue
    if (typeof input[field] !== 'string') return { error: `${field} must be text.` }
    const value = input[field].trim()
    if (!value && optionalFields.includes(field)) {
      updates[field] = ''
      continue
    }
    if (!value || value.length > limits[field]) return { error: `${field} must contain 1 to ${limits[field]} characters.` }
    updates[field] = value
  }
  return { updates }
}
