const AUTH_TOKEN_KEY = "tespit_auth_token"
const AUTH_USER_KEY = "tespit_auth_user"

export interface AuthUser {
  id: string
  nickname: string
  email: string
  joinDate: string
  name: string
}

export interface AuthData {
  token: string
  user: AuthUser
}

export function saveAuth(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return
  localStorage.setItem(AUTH_TOKEN_KEY, token)
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
}

export function getAuth(): AuthData | null {
  if (typeof window === "undefined") return null
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const userStr = localStorage.getItem(AUTH_USER_KEY)
  if (!token || !userStr) return null
  try {
    const user = JSON.parse(userStr) as AuthUser
    return { token, user }
  } catch {
    return null
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(AUTH_TOKEN_KEY)
}

export function clearAuth(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(AUTH_USER_KEY)
}
