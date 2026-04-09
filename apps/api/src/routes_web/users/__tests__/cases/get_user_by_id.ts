import type { Request } from 'express'
import { v4 as uuid } from 'uuid'
import { makeUserWithOrg } from '../../../../../tests/utils/user'
import { isEqual, isTruthy } from '../../../../../tests/utils/assertions'

export async function getUserById(_req: Request) {
  // Given
  const { user } = await makeUserWithOrg('users-get')
  const name = `GetTest ${uuid().substring(0, 8)}`
  const email = `get+${uuid().substring(0, 8)}@example.com`
  const created = await user.me.createUser({ name, email })

  // When
  const result = await user.me.getUser(created.data.id)

  // Then
  isEqual('user id matches', result.data.id, created.data.id)
  isEqual('user name matches', result.data.name, name)
  isEqual('user email matches', result.data.email, email)
  isTruthy('user has role', result.data.role)
}
