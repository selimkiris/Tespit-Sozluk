import { apiFetch, getApiUrl } from "@/lib/api"

export type ExistsLookupResult = {
  exists: boolean
  topicId?: string
  userId?: string
}

/**
 * Sunucu: TopicExistsResponseDto / UserExistsResponseDto (camelCase JSON).
 */
export async function fetchTopicExists(name: string): Promise<ExistsLookupResult> {
  const q = name.trim()
  if (!q) return { exists: false }
  try {
    const res = await apiFetch(getApiUrl(`api/Topics/exists?name=${encodeURIComponent(q)}`))
    if (!res.ok) return { exists: false }
    const data = (await res.json()) as { exists?: boolean; topicId?: string }
    return {
      exists: !!data.exists,
      topicId: data.topicId != null ? String(data.topicId) : undefined,
    }
  } catch {
    return { exists: false }
  }
}

export async function fetchUserExists(username: string): Promise<ExistsLookupResult> {
  const u = username.trim()
  if (!u) return { exists: false }
  try {
    const res = await apiFetch(getApiUrl(`api/Users/exists?username=${encodeURIComponent(u)}`))
    if (!res.ok) return { exists: false }
    const data = (await res.json()) as { exists?: boolean; userId?: string }
    return {
      exists: !!data.exists,
      userId: data.userId != null ? String(data.userId) : undefined,
    }
  } catch {
    return { exists: false }
  }
}

/**
 * Önbellek: cacheKey → son API sonucu (bkz:… / at:… anahtarları entry-pattern-scan ile uyumlu).
 */
export async function resolveExistsWithCache(
  kind: "bkz" | "at",
  raw: string,
  cache: Map<string, ExistsLookupResult>
): Promise<ExistsLookupResult> {
  const key = kind === "bkz" ? `bkz:${raw.trim().toLowerCase()}` : `at:${raw.trim().toLowerCase()}`
  const hit = cache.get(key)
  if (hit) return hit
  const result =
    kind === "bkz" ? await fetchTopicExists(raw) : await fetchUserExists(raw)
  cache.set(key, result)
  return result
}
