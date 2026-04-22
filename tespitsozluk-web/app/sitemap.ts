import type { MetadataRoute } from "next"
import { getApiUrl } from "@/lib/api"

/** Sitemap ve Google için sabit kanonik kök — env kullanılmaz (Vercel önizleme alanı vb. karışmasın). */
const SITE_ORIGIN = "https://tespitsozluk.com"

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
  try {
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
  } catch {
    return { items: [], hasNextPage: false }
  }
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
  const now = new Date()

  const [allTopics, trendIds] = await Promise.all([
    fetchAllTopicsAlphabetical(),
    fetchTrendTopicIds(),
  ])

  const topicEntries: MetadataRoute.Sitemap = allTopics.map((t) => ({
    url: `${SITE_ORIGIN}/?topic=${t.id}`,
    lastModified: t.createdAt ? new Date(t.createdAt) : now,
    changeFrequency: "weekly" as const,
    priority: trendIds.has(t.id) ? 0.9 : 0.7,
  }))

  return [
    {
      url: SITE_ORIGIN,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_ORIGIN}/hakkimizda`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    ...topicEntries,
  ]
}
