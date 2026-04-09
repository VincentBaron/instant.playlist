import type { Request } from 'express'
import { v4 as uuid } from 'uuid'
import { makeUserWithOrg } from '../../../../../tests/utils/user'
import { isEqual } from '../../../../../tests/utils/assertions'

export async function deleteUserSucceeds(_req: Request) {
  // Given
  const { user } = await makeUserWithOrg('users-delete')
  const name = `DeleteTest ${uuid().substring(0, 8)}`
  const email = `delete+${uuid().substring(0, 8)}@example.com`
  const created = await user.me.createUser({ name, email })

  // When
  const result = await user.me.deleteUser(created.data.id)

  // Then
  isEqual('delete returns 200', result.status, 200)

  // Verify user is gone
  await user.me.getUser(created.data.id, 404)
}
