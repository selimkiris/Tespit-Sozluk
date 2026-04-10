/**
 * Entry HTML gövdesinde arama terimini yalnızca metin düğümlerinde vurgular;
 * etiket yapısı, linkler ve (bkz)/@mention düzenlemeleri korunur.
 */

export const ENTRY_SEARCH_HIGHLIGHT_MARK_CLASS =
  "bg-yellow-200 dark:bg-yellow-500/30 text-black dark:text-white rounded-sm px-0.5"

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Boş / çok kısa sorgularda vurgulama yapılmaz (gürültüyü azaltır). */
export function shouldApplyEntrySearchHighlight(query: string | undefined | null): boolean {
  const t = typeof query === "string" ? query.trim() : ""
  return t.length >= 2
}

/**
 * DOMPurify sonrası güvenli HTML üzerinde çalışır; yalnızca metin düğümlerini böler,
 * `<a>`, `<mark>` içi vb. yapı korunur (eşleşme link metnindeyse `<mark>` `<a>` içinde kalır).
 */
export function highlightSearchInEntryHtml(html: string, rawQuery: string): string {
  if (!shouldApplyEntrySearchHighlight(rawQuery)) return html
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return html

  const query = rawQuery.trim()
  const escaped = escapeRegExp(query)

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div class="search-hl-wrap">${html}</div>`, "text/html")
  const root = doc.querySelector(".search-hl-wrap")
  if (!root) return html

  const ownerDoc = root.ownerDocument
  const textNodes: Text[] = []
  const walker = ownerDoc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const tnode = node as Text
      const parent = tnode.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest("mark")) return NodeFilter.FILTER_REJECT
      if (parent.closest("iframe")) return NodeFilter.FILTER_REJECT
      const tag = parent.tagName
      if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  let n: Node | null
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text)
  }

  for (const textNode of textNodes) {
    if (!textNode.parentNode) continue
    const text = textNode.data
    if (!text) continue

    const indices: { start: number; end: number }[] = []
    const r = new RegExp(escaped, "gi")
    let m: RegExpExecArray | null
    while ((m = r.exec(text)) !== null) {
      indices.push({ start: m.index, end: m.index + m[0].length })
    }
    if (indices.length === 0) continue

    const frag = ownerDoc.createDocumentFragment()
    let last = 0
    for (const { start, end } of indices) {
      if (start > last) {
        frag.appendChild(ownerDoc.createTextNode(text.slice(last, start)))
      }
      const mark = ownerDoc.createElement("mark")
      mark.setAttribute("class", ENTRY_SEARCH_HIGHLIGHT_MARK_CLASS)
      mark.appendChild(ownerDoc.createTextNode(text.slice(start, end)))
      frag.appendChild(mark)
      last = end
    }
    if (last < text.length) {
      frag.appendChild(ownerDoc.createTextNode(text.slice(last)))
    }
    textNode.parentNode.replaceChild(frag, textNode)
  }

  return root.innerHTML
}
