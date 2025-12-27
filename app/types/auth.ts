export type UserRole = 'admin' | 'employee'

export interface Org {
  id: string
  name: string
  org_code: string
  created_at: string
}

export interface Profile {
  id: string
  role: UserRole
  org_id: string | null
  is_org_verified: boolean
  created_at: string
  updated_at: string
}

export interface UserWithProfile {
  id: string
  email: string
  profile: Profile | null
}
