/**
 * Tüm API istekleri C# backend'e (NEXT_PUBLIC_API_URL) gider.
 * Authorization: Bearer token gerektiren istekler için getAuthToken() kullanın.
 */

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5295"

/** Sitenin public URL'si (paylaşım, OG meta için). Server & client uyumlu. */
export function getSiteUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin
  }
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  if (url) {
    const base = url.startsWith("http") ? url : `https://${url}`
    return base.replace(/\/$/, "")
  }
  return "https://tespitsozluk.com"
}

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
