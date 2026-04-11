/**
 * TipTap Image düğümü ↔ depolanan HTML içinde düz `![alt](url)` metni dönüşümü.
 * Yayın tarafı applyMarkdownImages ile aynı kalır.
 */

import type { Editor } from "@tiptap/core"
import { escapeHtmlAttr } from "@/lib/entry-body-link-transforms"

const IMG_TAG_RE = /<img\b[^>]*>/gi

function decodeBasicEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
}

function pickAttr(tag: string, name: string): string {
  const d = tag.match(new RegExp(`${name}="([^"]*)"`, "i"))
  if (d?.[1] != null) return decodeBasicEntities(d[1])
  const s = tag.match(new RegExp(`${name}='([^']*)'`, "i"))
  if (s?.[1] != null) return decodeBasicEntities(s[1])
  return ""
}

/** Depolama / parent state: <img> → ![alt](src) düz metin */
export function editorImageHtmlToMarkdownText(html: string): string {
  return html.replace(IMG_TAG_RE, (tag) => {
    const src = pickAttr(tag, "src").trim()
    const alt = pickAttr(tag, "alt").trim() || "Görsel"
    if (!src) return tag
    const safeAlt = alt.replace(/[[\]]/g, "")
    return `![${safeAlt || "Görsel"}](${src})`
  })
}

/** Editöre yükleme: HTML içindeki ![alt](url) → <img> (TipTap Image) */
export function storedHtmlToEditorImageHtml(html: string, imgClass: string): string {
  return html.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    (_full, altRaw: string, srcRaw: string) => {
      const alt = escapeHtmlAttr((altRaw ?? "").trim() || "Görsel")
      const src = escapeHtmlAttr(srcRaw.trim())
      const cls = escapeHtmlAttr(imgClass)
      return `<img src="${src}" alt="${alt}" class="${cls}">`
    },
  )
}

/** Karakter sınırı: metin + her görsel için depolanan `![alt](src) ` uzunluğu */
export function entryBodyCharCount(editor: Editor): number {
  let imageChars = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === "image") {
      const src = String(node.attrs.src ?? "").trim()
      const alt = String(node.attrs.alt ?? "Görsel").replace(/[[\]]/g, "") || "Görsel"
      if (src) imageChars += `![${alt}](${src}) `.length
    }
  })
  return editor.getText().length + imageChars
}
