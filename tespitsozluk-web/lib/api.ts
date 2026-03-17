/**
 * Tüm API istekleri C# backend'e (NEXT_PUBLIC_API_URL) gider.
 * Authorization: Bearer token gerektiren istekler için getAuthToken() kullanın.
 */

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5295"

export function getApiUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "")
  const p = path.startsWith("/") ? path : `/${path}`
  return `${base}${p}`
}

export function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {}
  const token = localStorage.getItem("tespit_auth_token")
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  return headers
}
