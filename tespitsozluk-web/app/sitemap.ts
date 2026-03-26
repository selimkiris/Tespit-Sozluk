import type { MetadataRoute } from "next"
import { getApiUrl, getSiteUrl } from "@/lib/api"

/** Site haritası önbelleği (saniye). */
export const revalidate = 3600

type TopicListItem = {
  id: string
  createdAt?: string
}

async function fetchTopicPage(
  variant: "alphabetical" | "latest",
  page: number,
  pageSize: number
): Promise<{ items: TopicListItem[]; hasNextPage: boolean }> {
  const res = await fetch(
    getApiUrl(`api/Topics/${variant}?page=${page}&pageSize=${pageSize}`),
    { next: { revalidate } }
  )
  if (!res.ok) {
    return { items: [], hasNextPage: false }
  }
  const data: {
    items?: Array<{ id?: string; createdAt?: string }>
    hasNextPage?: boolean
  } = await res.json()
  const raw = data?.items ?? []
  const items: TopicListItem[] = []
  for (const t of raw) {
    if (t?.id) items.push({ id: String(t.id), createdAt: t.createdAt })
  }
  return { items, hasNextPage: data?.hasNextPage ?? false }
}

/** Tüm başlık ID'leri — alfabetik endpoint ile sayfalanır. */
async function fetchAllTopicsAlphabetical(): Promise<TopicListItem[]> {
  const out: TopicListItem[] = []
  const pageSize = 100
  let page = 1
  for (;;) {
    const { items, hasNextPage } = await fetchTopicPage("alphabetical", page, pageSize)
    out.push(...items)
    if (!hasNextPage || items.length === 0) break
    page += 1
    if (page > 5000) break
  }
  return out
}

/** Trend sayılacak en yeni başlıklar — `api/Topics/latest` ilk sayfa (sidebar ile uyumlu). */
async function fetchTrendTopicIds(): Promise<Set<string>> {
  const { items } = await fetchTopicPage("latest", 1, 100)
  return new Set(items.map((t) => t.id))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl()
  const now = new Date()

  const [allTopics, trendIds] = await Promise.all([
    fetchAllTopicsAlphabetical(),
    fetchTrendTopicIds(),
  ])

  const topicEntries: MetadataRoute.Sitemap = allTopics.map((t) => ({
    url: `${base}/?topic=${t.id}`,
    lastModified: t.createdAt ? new Date(t.createdAt) : now,
    changeFrequency: "weekly" as const,
    priority: trendIds.has(t.id) ? 0.9 : 0.7,
  }))

  return [
    {
      url: base,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    ...topicEntries,
  ]
}
