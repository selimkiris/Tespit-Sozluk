/**
 * Sistem avatar galerisi: 250 adet DiceBear 7.x SVG (yalnızca https://api.dicebear.com/7.x/...).
 * Stiller: notionists, bottts, fun-emoji, shapes, lorelei, avataaars, micah (karışık sıra, round-robin).
 */

const TOTAL = 250

/** 36×5 + 35×2 = 250 */
const DICEBEAR_STYLES = [
  { style: "notionists" as const, count: 36 },
  { style: "bottts" as const, count: 36 },
  { style: "fun-emoji" as const, count: 36 },
  { style: "shapes" as const, count: 36 },
  { style: "lorelei" as const, count: 36 },
  { style: "avataaars" as const, count: 35 },
  { style: "micah" as const, count: 35 },
] as const

function dicebearSvgUrl(style: string, index: number): string {
  const seed = `${style}-${index}`
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`
}

function buildPerStyleUrlLists(): string[][] {
  return DICEBEAR_STYLES.map(({ style, count }) =>
    Array.from({ length: count }, (_, i) => dicebearSvgUrl(style, i)),
  )
}

function interleaveRoundRobin(lists: string[][]): string[] {
  const out: string[] = []
  const maxLen = Math.max(0, ...lists.map((a) => a.length))
  for (let i = 0; i < maxLen; i++) {
    for (const list of lists) {
      if (i < list.length) out.push(list[i]!)
    }
  }
  return out
}

function buildDicebearGalleryUrls(): string[] {
  return interleaveRoundRobin(buildPerStyleUrlLists())
}

export const HYBRID_AVATAR_URLS: readonly string[] = (() => {
  const urls = buildDicebearGalleryUrls()
  if (urls.length !== TOTAL) {
    throw new Error(`Sistem avatar URL sayısı ${TOTAL} olmalı (gelen: ${urls.length}).`)
  }
  return urls
})()

export const HYBRID_AVATAR_COUNT = TOTAL
