import type { Request } from 'express'
import { v4 as uuid } from 'uuid'
import { makeUserWithOrg } from '../../../../../tests/utils/user'
import { isTruthy, isEqual } from '../../../../../tests/utils/assertions'

export async function createUserSucceeds(_req: Request) {
  // Given
  const { user } = await makeUserWithOrg('users-create')
  const newName = `Test User ${uuid().substring(0, 8)}`
  const newEmail = `test+${uuid().substring(0, 8)}@example.com`

  // When
  const result = await user.me.createUser({ name: newName, email: newEmail })

  // Then
  isEqual('status is 200', result.status, 200)
  isTruthy('response has user id', result.data.id)
  isEqual('name matches', result.data.name, newName)
  isEqual('email matches', result.data.email, newEmail)
}
