export interface AuthResponse {
  token: string
  userId: string
  email: string
  firstName: string
  lastName: string
  username?: string
  avatar?: string | null
  hasChangedUsername?: boolean
  role?: string
}
