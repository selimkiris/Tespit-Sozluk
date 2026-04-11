/**
 * Entry gövdesi HTML'i için (bkz) ve @mention markdown dönüşümleri (HtmlRenderer).
 */

import { hrefForBkzTerm } from "@/lib/editor-link-href"

export function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/\r|\n/g, " ")
}

/**
 * TipTap’ta eklenen `![alt](https://...)` görsellerini küçük kare önizleme + tıklanınca lightbox (HtmlRenderer).
 */
export function applyMarkdownImages(html: string): string {
  const thumbImgClass =
    "!inline w-[1.2em] h-[1.2em] max-h-[1em] object-cover rounded-sm align-middle mx-1 border border-muted-foreground/10 hover:opacity-80 transition-opacity !m-0"
  const thumbLinkClass = "!inline !m-0 align-middle"
  return html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi,
    (_full, altRaw: string, srcRaw: string) => {
      const alt = escapeHtmlAttr((altRaw ?? "").trim() || "Görsel")
      const href = escapeHtmlAttr(srcRaw.trim())
      const img = `<img src="${href}" alt="${alt}" class="${thumbImgClass}" loading="lazy" referrerpolicy="no-referrer" />`
      return `<a href="${href}" data-entry-image-lightbox="1" rel="noopener noreferrer" class="${thumbLinkClass}">${img}</a>`
    },
  )
}

const EMERALD_LINK_CLASS = "text-emerald-500 font-medium hover:underline"

/**
 * Backend ile uyumlu: [@user](/user/{guid}) markdown kalıbı.
 */
export function applyMentionLinks(html: string): string {
  return html.replace(
    /\[@([^\]]+)\]\(\/user\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)/gi,
    (_, username: string, userId: string) => {
      const u = escapeHtmlText(username)
      return `<a href="/user/${userId}" data-profile-link="1" class="${EMERALD_LINK_CLASS}">@${u}</a>`
    }
  )
}

/**
 * (bkz: terim) — yayın görünümünde arama; sunucu işlenmiş içerikte topic linki gelir.
 * Geçersiz / boş terim: link yok (yeşil & href="/" oluşmaz).
 */
export function applyBkzLinks(html: string): string {
  return html.replace(/\(bkz:\s*([^)]+)\)/gi, (_full, kelime: string) => {
    const t = kelime.trim()
    if (!t) {
      return escapeHtmlText(`(bkz: ${kelime})`)
    }
    const href = hrefForBkzTerm(t)
    if (href === "/") {
      return escapeHtmlText(`(bkz: ${kelime.trim()})`)
    }
    const safe = escapeHtmlText(t)
    return `<a href="${href}" class="${EMERALD_LINK_CLASS}">(bkz: ${safe})</a>`
  })
}
