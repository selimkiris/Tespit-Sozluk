/**
 * Başlık detayına giden istemci tarafı href'ini üretir.
 *
 * - Slug varsa SEO rotası kullanılır: `/baslik/<slug>`
 * - Slug yoksa (henüz API'dan gelmediyse vb.) eski yapıya düşer: `/?topic=<id>`
 *   Bu eski yapı `app/page.tsx` içindeki sunucu tarafı redirect ile yeni
 *   rotaya otomatik olarak yönlendirilir (SEO için 301 benzeri davranış).
 */
export type TopicLike = {
  id: string | number
  slug?: string | null
}

export function topicHref(topic: TopicLike | null | undefined): string {
  const slug = typeof topic?.slug === "string" ? topic.slug.trim() : ""
  if (slug) return `/baslik/${slug}`
  const rawId = topic?.id
  const id = typeof rawId === "string" ? rawId.trim() : rawId != null ? String(rawId) : ""
  if (!id) return "/"
  return `/?topic=${encodeURIComponent(id)}`
}

/**
 * Slug bilinmiyorsa yalnızca ID ile kullanılabilen kısa yol. Yukarıdaki redirect
 * mekanizması eski URL'leri yeni rotaya taşıyacağı için SEO açısından güvenlidir.
 */
export function topicHrefById(topicId: string | number): string {
  return topicHref({ id: topicId })
}

/**
 * Başlık sayfasına belirli bir `?page=` ile gider. Slug varsa yeni rotada
 * `/baslik/<slug>?page=N`, aksi halde eski `/?topic=<id>&page=N` döner.
 */
export function topicPageHref(topic: TopicLike | null | undefined, page: number): string {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const base = topicHref(topic)
  if (base === "/") return base
  const separator = base.includes("?") ? "&" : "?"
  return `${base}${separator}page=${safePage}`
}
