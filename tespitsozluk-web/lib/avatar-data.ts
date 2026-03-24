/**
 * Sistem avatar galerisi: 500 adet DiceBear 7.x SVG (yalnızca https://api.dicebear.com/7.x/...).
 * Stiller: notionists, bottts, lorelei.
 */

const DICEBEAR_STYLES = ["notionists", "bottts", "lorelei"] as const
/** 167 + 167 + 166 = 500 */
const PER_STYLE_COUNTS = [167, 167, 166] as const

function buildDicebearGalleryUrls(): string[] {
  const urls: string[] = []
  for (let s = 0; s < DICEBEAR_STYLES.length; s++) {
    const style = DICEBEAR_STYLES[s]!
    const n = PER_STYLE_COUNTS[s]!
    for (let i = 0; i < n; i++) {
      urls.push(`https://api.dicebear.com/7.x/${style}/svg?seed=${style}-${i}`)
    }
  }
  return urls
}

export const HYBRID_AVATAR_URLS: readonly string[] = (() => {
  const urls = buildDicebearGalleryUrls()
  if (urls.length !== 500) {
    throw new Error("Sistem avatar URL sayısı 500 olmalı.")
  }
  return urls
})()

export const HYBRID_AVATAR_COUNT = 500
