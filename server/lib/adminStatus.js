import { randomUUID } from 'node:crypto'

export async function updateAdminTargetStatus({
  actorId,
  targetId,
  status,
  findUser,
  isAdmin,
  countActiveAdmins,
  acquireLock,
  releaseLock,
  updateUser
}) {
  if (!['active', 'suspended', 'banned'].includes(status)) return { status: 400, error: 'Choose active, suspended, or banned status' }
  if (String(actorId) === String(targetId)) return { status: 400, error: 'You cannot suspend your own account' }

  let target = await findUser(targetId)
  if (!target) return { status: 404, error: 'User not found' }
  const isActive = !target.blocked && !['suspended', 'banned'].includes(target.status || 'active')
  if (status !== 'active' && isActive && isAdmin(target)) {
    const lockToken = randomUUID()
    if (!await acquireLock(lockToken)) return { status: 409, error: 'Another administrator change is in progress. Try again.' }
    try {
      target = await findUser(targetId)
      const stillActiveAdmin = target && !target.blocked &&
        !['suspended', 'banned'].includes(target.status || 'active') && isAdmin(target)
      if (stillActiveAdmin && await countActiveAdmins() <= 1) {
        return { status: 409, error: 'The last active administrator cannot be suspended or banned.' }
      }
      if (!target) return { status: 404, error: 'User not found' }
      return await updateUser(targetId, status)
    } finally {
      await releaseLock(lockToken)
    }
  }
  return updateUser(targetId, status)
}
