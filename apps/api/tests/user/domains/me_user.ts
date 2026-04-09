import type { BaseUser } from '../base_user'
import type { ExpectedResponseCode } from '../../utils/requests'

type ProfileResponse = {
  id: string
  name: string
  email: string
  role: string | null
}

type OrganizationsResponse = {
  organizations: Array<{
    id: string
    name: string
    slug: string
    role: string
  }>
}

/**
 * Domain user for /me endpoints.
 */
export class MeUser {
  constructor(private readonly user: BaseUser) {}

  async getProfile(expectedCode: ExpectedResponseCode = 200) {
    return this.user.get_auth<ProfileResponse>('/me', expectedCode)
  }

  async getOrganizations(expectedCode: ExpectedResponseCode = 200) {
    return this.user.get_auth<OrganizationsResponse>('/me/organizations', expectedCode)
  }

  async getUsers(expectedCode: ExpectedResponseCode = 200) {
    return this.user.get_auth<{ users: any[]; total: number }>('/users', expectedCode)
  }

  async getUser(userId: string, expectedCode: ExpectedResponseCode = 200) {
    return this.user.get_auth<{ id: string; name: string; email: string; role: string }>(`/users/${userId}`, expectedCode)
  }

  async createUser(input: { name: string; email: string }, expectedCode: ExpectedResponseCode = 200) {
    return this.user.post_auth<{ id: string; name: string; email: string; role: string }>('/users', input, expectedCode)
  }

  async updateUser(userId: string, input: { name?: string; email?: string; role?: string }, expectedCode: ExpectedResponseCode = 200) {
    return this.user.patch_auth<{ id: string; name: string; email: string; role: string }>(`/users/${userId}`, input, expectedCode)
  }

  async deleteUser(userId: string, expectedCode: ExpectedResponseCode = 200) {
    return this.user.del_auth(`/users/${userId}`, expectedCode)
  }
}
