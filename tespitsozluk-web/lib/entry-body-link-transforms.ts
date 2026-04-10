/**
 * Entry gövdesi HTML'i için (bkz) ve @mention markdown dönüşümleri (HtmlRenderer).
 */

import { hrefForBkzTerm } from "@/lib/editor-link-href"

export function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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
