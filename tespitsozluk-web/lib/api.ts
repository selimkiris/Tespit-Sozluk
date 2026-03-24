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

/** GET api/Entries/{id}/likes — yalnızca entry sahibi (yetkili oturum). */
export type EntryUpvoterUser = {
  id: string
  name: string
  username?: string | null
  avatar?: string | null
}

export async function fetchEntryUpvoters(entryId: string): Promise<EntryUpvoterUser[]> {
  const res = await fetch(getApiUrl(`api/Entries/${entryId}/likes`), {
    headers: getAuthHeaders(),
  })
  if (!res.ok) {
    throw new Error(`entry_likes_${res.status}`)
  }
  const data: unknown = await res.json().catch(() => [])
  if (!Array.isArray(data)) return []
  return data.map((raw) => {
    const u = raw as Record<string, unknown>
    return {
      id: String(u.id ?? ""),
      name: typeof u.name === "string" ? u.name : "",
      username: typeof u.username === "string" || u.username === null ? (u.username as string | null) : null,
      avatar: typeof u.avatar === "string" || u.avatar === null ? (u.avatar as string | null) : null,
    }
  })
}
