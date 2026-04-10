/**
 * Tüm API istekleri C# backend'e (NEXT_PUBLIC_API_URL) gider.
 * Kimlik doğrulamalı istekler için apiFetch kullanın (Bearer + 401 davranışı).
 */

import { clearAuth, getAuthToken } from "./auth"

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5295"

/** Sitenin public URL'si (paylaşım, OG meta için). Önce env — SSR ile hydration aynı kalır. */
export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  if (url) {
    const base = url.startsWith("http") ? url : `https://${url}`
    return base.replace(/\/$/, "")
  }
  if (typeof window !== "undefined") {
    return window.location.origin
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

let sessionExpiredRedirectInFlight = false

function shouldIgnore401ForSessionHandling(url: string): boolean {
  const u = url.toLowerCase()
  if (u.includes("/api/auth/login")) return true
  if (u.includes("/api/auth/register")) return true
  if (u.includes("/api/auth/reset-password")) return true
  return false
}

/**
 * Backend fetch: getAuthHeaders ile birleştirir. 401 + geçerli oturum token'ı ise
 * localStorage temizlenir, toast gösterilir, /login'e yönlendirilir.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const baseHeaders = getAuthHeaders()
  const merged = new Headers(baseHeaders)
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => merged.set(key, value))
  }
  const res = await fetch(input, { ...init, headers: merged })
  if (
    typeof window !== "undefined" &&
    res.status === 401 &&
    !shouldIgnore401ForSessionHandling(input) &&
    getAuthToken()
  ) {
    if (!sessionExpiredRedirectInFlight) {
      sessionExpiredRedirectInFlight = true
      clearAuth()
      void import("sonner").then(({ toast }) => {
        toast.error("Oturumunuz sona erdi, lütfen tekrar giriş yapın")
      })
      window.location.assign("/login")
    }
  }
  return res
}

/** GET api/Entries/{id}/likes — yalnızca entry sahibi (yetkili oturum). */
export type EntryUpvoterUser = {
  id: string
  name: string
  username?: string | null
  avatar?: string | null
}

export async function fetchEntryUpvoters(entryId: string): Promise<EntryUpvoterUser[]> {
  const res = await apiFetch(getApiUrl(`api/Entries/${entryId}/likes`))
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
