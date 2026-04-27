const MD_IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g

export type MessageMarkdownImage = { src: string; alt: string }

export type MessageContentSegment =
  | { type: "text"; content: string }
  | { type: "image"; src: string; alt: string; index: number }

type ImageHit = {
  start: number
  end: number
  src: string
  alt: string
}

function collectImageHits(s: string): ImageHit[] {
  const hits: ImageHit[] = []
  const md = new RegExp(MD_IMAGE_RE.source, "g")
  let m: RegExpExecArray | null
  while ((m = md.exec(s)) !== null) {
    const src = m[2]?.trim()
    if (src) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        src,
        alt: (m[1] || "Görsel").trim(),
      })
    }
  }
  const html = /<img\b([^>]*>)/gi
  while ((m = html.exec(s)) !== null) {
    const full = m[0]
    const srcM = /src=["']([^"']+)["']/i.exec(full)
    if (!srcM?.[1]) continue
    const altM = /alt=["']([^"']*)["']/i.exec(full)
    hits.push({
      start: m.index,
      end: m.index + full.length,
      src: srcM[1].trim(),
      alt: (altM?.[1] ?? "Görsel").trim(),
    })
  }
  hits.sort((a, b) => a.start - b.start)
  const out: ImageHit[] = []
  let lastEnd = 0
  for (const h of hits) {
    if (h.start < lastEnd) continue
    out.push(h)
    lastEnd = h.end
  }
  return out
}

/** Metin + görseller soldan sağa (inline); lightbox index görünüm sırası. */
export function parseMessageToSegments(message: string): MessageContentSegment[] {
  const s = String(message ?? "")
  if (!s) {
    return [{ type: "text", content: "" }]
  }
  const hitList = collectImageHits(s)
  if (hitList.length === 0) {
    return [{ type: "text", content: s }]
  }
  const segments: MessageContentSegment[] = []
  let cur = 0
  let imgIndex = 0
  for (const h of hitList) {
    if (h.start > cur) {
      segments.push({ type: "text", content: s.slice(cur, h.start) })
    }
    segments.push({ type: "image", src: h.src, alt: h.alt, index: imgIndex++ })
    cur = h.end
  }
  if (cur < s.length) {
    segments.push({ type: "text", content: s.slice(cur) })
  }
  if (segments.length === 0) {
    return [{ type: "text", content: s }]
  }
  return segments
}

/** Markdown + `<img …>`; lightbox ile aynı sırada. */
export function listAllMessageImages(text: string): MessageMarkdownImage[] {
  return parseMessageToSegments(text)
    .filter((s): s is MessageContentSegment & { type: "image" } => s.type === "image")
    .map((s) => ({ src: s.src, alt: s.alt }))
}

export function listMarkdownImages(text: string): MessageMarkdownImage[] {
  const images: MessageMarkdownImage[] = []
  const re = new RegExp(MD_IMAGE_RE.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const src = m[2]?.trim()
    if (src) images.push({ src, alt: (m[1] || "Görsel").trim() })
  }
  return images
}

/** Görüntüleme: sadece düz metin (markdown görüntü ifadeleri kaldırılır). */
export function displayTextWithoutImageMarkdown(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "")
    .replace(/[ \t\u00a0]+$/gm, "")
    .trim()
}

/** Tüm `![...](...)` eşleşmeleri korunarak, `index` konumundaki parça kaldırılır. */
export function removeMarkdownImageAtIndex(text: string, index: number): string {
  const re = new RegExp(MD_IMAGE_RE.source, "g")
  let m: RegExpExecArray | null
  let i = 0
  const out: string[] = []
  let last = 0
  while ((m = re.exec(text)) !== null) {
    out.push(text.slice(last, m.index))
    if (i !== index) {
      out.push(m[0])
    }
    i += 1
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return out.join("").replace(/\n{3,}/g, "\n\n")
}
