/** Entry/taslak editörleri için boşluk ve boş paragrafları budar (modal formlarıyla aynı mantık). */
export function trimComposerHtml(html: string): string {
  if (!html) return ""
  let result = html.replace(/^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+/gi, "")
  result = result.replace(/(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+$/gi, "")
  return result.trim()
}

/** Uyarı göstermek için anlamlı içerik var mı (düz metin veya satır içi görsel). */
export function hasMeaningfulComposerHtml(html: string): boolean {
  const t = trimComposerHtml(html)
  if (!t) return false
  if (/<img\b/i.test(t)) return true
  const plain = t.replace(/<[^>]*>/g, "").trim()
  return plain.length > 0
}
