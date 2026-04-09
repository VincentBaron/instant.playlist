import type { Request } from 'express'
import { makeUserWithOrg } from '../../../../../tests/utils/user'
import { isTruthy, isGreaterThanOrEqual } from '../../../../../tests/utils/assertions'

export async function getUsersReturnsList(_req: Request) {
  // Given
  const { user } = await makeUserWithOrg('users-list')

  // When
  const result = await user.me.getUsers()

  // Then
  isTruthy('response has users array', Array.isArray(result.data.users))
  isGreaterThanOrEqual('total is at least 1', result.data.total, 1)
}
