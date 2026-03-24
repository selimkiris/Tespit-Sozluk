/**
 * Görünür metin uzunluğu (HTML etiketleri hariç). İstemci ve sunucuda tutarlı sayım için
 * mümkünse DOM kullanır.
 */
export function getHtmlPlainTextLength(html: string): number {
  if (!html?.trim()) return 0
  if (typeof document !== "undefined") {
    try {
      const d = document.createElement("div")
      d.innerHTML = html
      return d.textContent?.length ?? 0
    } catch {
      /* fall through */
    }
  }
  return html.replace(/<[^>]*>/g, "").length
}

/**
 * Görünür metin en fazla maxChars olacak şekilde HTML'i keser; açık etiketleri kapatır
 * ve kesim noktasından sonraki düğümleri kaldırır. Yalnızca tarayıcıda çalışır.
 */
export function truncateHtmlByTextLength(html: string, maxChars: number): string {
  if (typeof document === "undefined" || !html?.trim() || maxChars <= 0) return html
  try {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = html
    let count = 0
    let cutTextNode: Text | null = null

    function walk(node: Node): boolean {
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text
        const text = textNode.data
        if (count + text.length <= maxChars) {
          count += text.length
          return false
        }
        const remain = Math.max(0, maxChars - count)
        const rawCut = text.slice(0, remain)
        // Kelime ortasından kesme — son boşluğa kadar geri çekil
        const lastSpace = rawCut.lastIndexOf(" ")
        textNode.data = lastSpace > 0 ? rawCut.slice(0, lastSpace) : rawCut
        count = maxChars
        cutTextNode = textNode
        return true
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        for (const child of Array.from(node.childNodes)) {
          if (walk(child)) return true
        }
      }
      return false
    }

    if (!walk(wrapper)) return html

    if (cutTextNode) {
      let n: Node | null = cutTextNode
      while (n && n !== wrapper) {
        while (n.nextSibling) {
          n.parentNode?.removeChild(n.nextSibling)
        }
        n = n.parentNode
      }
    }

    return wrapper.innerHTML
  } catch {
    return html
  }
}
