export type User = {
  id: string
  name: string
  email: string
  role: string
  createdAt: string
  updatedAt: string
}

export type CreateUserInput = {
  name: string
  email: string
}

export type UpdateUserInput = {
  name?: string
  email?: string
  role?: string
}

export type UserQuery = {
  page: number
  pageSize: number
  search?: string
}

// Database result type (matches Better Auth 'user' table)
export type DbUser = {
  id: string
  name: string
  email: string
  email_verified: boolean
  image: string | null
  role: string
  created_at: Date
  updated_at: Date
}
