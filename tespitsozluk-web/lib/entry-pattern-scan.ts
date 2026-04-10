import type { Node as PMNode } from "@tiptap/pm/model"

/** Terim ')' içeremez */
export const BKZ_PATTERN = /\(bkz:\s*([^)]+)\)/gi

/**
 * @mention — önek (satır başı / boşluk / parantez); kullanıcı adında ) yok.
 */
export const AT_PATTERN = /(^|[\s(])@([^<>\s@)]{1,20})/g

export type PatternKind = "bkz" | "at"

export type ScannedPatternSpan = {
  from: number
  to: number
  kind: PatternKind
  /** API ve önbellek anahtarı */
  cacheKey: string
  /** Ham terim / kullanıcı adı */
  raw: string
}

function spansOverlap(a: { from: number; to: number }, b: { from: number; to: number }): boolean {
  return a.from < b.to && a.to > b.from
}

/**
 * Metin düğümündeki tamamlanmış (bkz: …) ve @… aralıklarını döndürür.
 */
export function collectPatternSpansInTextNode(text: string, basePos: number): ScannedPatternSpan[] {
  const bkz: ScannedPatternSpan[] = []
  let m: RegExpExecArray | null
  BKZ_PATTERN.lastIndex = 0
  while ((m = BKZ_PATTERN.exec(text)) !== null) {
    const raw = m[1].trim()
    if (!raw) continue
    const from = basePos + m.index
    const to = from + m[0].length
    bkz.push({
      from,
      to,
      kind: "bkz",
      cacheKey: `bkz:${raw.toLowerCase()}`,
      raw,
    })
  }

  const at: ScannedPatternSpan[] = []
  AT_PATTERN.lastIndex = 0
  while ((m = AT_PATTERN.exec(text)) !== null) {
    const raw = m[2]
    if (!raw) continue
    const atStart = basePos + m.index + m[1].length
    const from = atStart
    const to = atStart + 1 + raw.length
    const span: ScannedPatternSpan = {
      from,
      to,
      kind: "at",
      cacheKey: `at:${raw.toLowerCase()}`,
      raw,
    }
    if (bkz.some((b) => spansOverlap(span, b))) continue
    at.push(span)
  }

  return [...bkz, ...at]
}

export function scanDocForPatternSpans(doc: PMNode): ScannedPatternSpan[] {
  const out: ScannedPatternSpan[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    out.push(...collectPatternSpansInTextNode(node.text, pos))
  })
  return out
}
