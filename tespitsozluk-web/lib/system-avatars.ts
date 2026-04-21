/** Eski Twemoji tabanlı hazır avatarlar (geriye dönük uyumluluk). */
export const SYSTEM_AVATARS: ReadonlyArray<{ id: string; emoji: string; url: string }> = [
  { id: "grin", emoji: "😀", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f600.png" },
  { id: "cat", emoji: "🐱", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f431.png" },
  { id: "dog", emoji: "🐶", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f436.png" },
  { id: "fox", emoji: "🦊", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f98a.png" },
  { id: "bear", emoji: "🐻", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43b.png" },
  { id: "lion", emoji: "🦁", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f981.png" },
  { id: "panda", emoji: "🐼", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f43c.png" },
  { id: "koala", emoji: "🐨", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f428.png" },
  { id: "frog", emoji: "🐸", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f438.png" },
  { id: "owl", emoji: "🦉", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f989.png" },
  { id: "rocket", emoji: "🚀", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f680.png" },
  { id: "star", emoji: "⭐", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2b50.png" },
  { id: "coffee", emoji: "☕", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/2615.png" },
  { id: "books", emoji: "📚", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f4da.png" },
  { id: "guitar", emoji: "🎸", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3b8.png" },
  { id: "palette", emoji: "🎨", url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f3a8.png" },
]

/** DiceBear 7.x — dört stil, her biri 100 tohum; galeri round-robin ile karıştırılır (modül yükünde tek sefer). */
export const DICEBEAR_GALLERY_STYLES = [
  "bottts",
  "lorelei",
  "fun-emoji",
  "shapes",
] as const

export type DicebearGalleryStyle = (typeof DICEBEAR_GALLERY_STYLES)[number]

export type DicebearGalleryItem = {
  id: string
  style: DicebearGalleryStyle
  seed: string
  url: string
}

const PER_STYLE = 100

function dicebearSvgUrl(style: string, seed: string): string {
  const q = encodeURIComponent(seed)
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${q}`
}

function buildPerStyleLists(): Record<DicebearGalleryStyle, DicebearGalleryItem[]> {
  const out = {} as Record<DicebearGalleryStyle, DicebearGalleryItem[]>
  for (const style of DICEBEAR_GALLERY_STYLES) {
    out[style] = Array.from({ length: PER_STYLE }, (_, index) => {
      const seed = `${style}-${index}`
      return {
        id: `dicebear-7-${style}-${index}`,
        style,
        seed,
        url: dicebearSvgUrl(style, seed),
      }
    })
  }
  return out
}

function interleaveGallery(perStyle: Record<DicebearGalleryStyle, DicebearGalleryItem[]>): DicebearGalleryItem[] {
  const mixed: DicebearGalleryItem[] = []
  for (let i = 0; i < PER_STYLE; i++) {
    for (const style of DICEBEAR_GALLERY_STYLES) {
      mixed.push(perStyle[style][i]!)
    }
  }
  return mixed
}

const _PER_STYLE_LISTS = buildPerStyleLists()

export const DICEBEAR_SYSTEM_AVATARS: ReadonlyArray<DicebearGalleryItem> =
  interleaveGallery(_PER_STYLE_LISTS)

const PRESET_URLS = new Set(SYSTEM_AVATARS.map((a) => a.url))

/** Önceki sürümde kullanılan adventurer + tüm hibrit galeri stilleri (kayıtlı profil URL'leri için). */
const DICEBEAR_PATH_RE =
  /^\/7\.x\/(?:adventurer|avataaars|bottts|fun-emoji|icons|lorelei|micah|notionists|shapes)\/svg$/i

export function isDicebearSystemAvatarUrl(url: string | null | undefined): boolean {
  const u = url?.trim()
  if (!u) return false
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== "https:") return false
    if (parsed.hostname !== "api.dicebear.com") return false
    if (!DICEBEAR_PATH_RE.test(parsed.pathname)) return false
    const seed = parsed.searchParams.get("seed")
    return !!seed?.length
  } catch {
    return false
  }
}

export function isSystemAvatarUrl(url: string | null | undefined): boolean {
  const u = url?.trim()
  return !!u && (PRESET_URLS.has(u) || isDicebearSystemAvatarUrl(u))
}
