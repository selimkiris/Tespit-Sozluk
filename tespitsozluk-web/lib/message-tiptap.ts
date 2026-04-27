import type { Editor, JSONContent } from "@tiptap/core"

const MD_IMG = /!\[([^\]]*)\]\(([^)]+)\)/g

/** `rich-text-editor` ile birebir aynı — entry yazma alanındaki satır içi görsel. */
const INLINE_IMG_CLASS =
  "!inline w-[1.2em] h-[1.2em] max-h-[1em] object-cover rounded-sm align-middle mx-1 border border-muted-foreground/10 hover:opacity-80 transition-opacity !m-0"

/** Tek paragrafta satırlar (hard break) + satır içi img — API’de saklanan markdown. */
export function messageMarkdownToDocJson(markdown: string): JSONContent {
  const s = String(markdown ?? "")
  if (!s) {
    return { type: "doc", content: [{ type: "paragraph" }] }
  }
  const lines = s.split(/\r?\n/)
  const parContent: JSONContent[] = []
  for (let li = 0; li < lines.length; li++) {
    if (li > 0) {
      parContent.push({ type: "hardBreak" })
    }
    const line = lines[li] ?? ""
    const re = new RegExp(MD_IMG.source, "g")
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) {
        const t = line.slice(last, m.index)
        if (t) {
          parContent.push({ type: "text", text: t })
        }
      }
      const src = (m[2] ?? "").trim()
      if (src) {
        const rawAlt = (m[1] ?? "Görsel").replace(/[[\]]/g, "").trim() || "Görsel"
        parContent.push({ type: "image", attrs: { src, alt: rawAlt } })
      }
      last = m.index + m[0].length
    }
    if (last < line.length) {
      const t = line.slice(last)
      if (t) {
        parContent.push({ type: "text", text: t })
      }
    }
  }
  if (parContent.length === 0) {
    return { type: "doc", content: [{ type: "paragraph" }] }
  }
  return { type: "doc", content: [{ type: "paragraph", content: parContent }] }
}

/** TipTap’tan API’de kullanılan markdown (yalnızca düz metin + `![alt](url)`). */
export function messageEditorToMarkdown(editor: Editor): string {
  const lines: string[] = []
  editor.state.doc.forEach((node) => {
    if (node.type.name !== "paragraph") return
    const parts: string[] = []
    node.forEach((child) => {
      if (child.isText) {
        parts.push(child.text ?? "")
      } else if (child.type.name === "hardBreak") {
        parts.push("\n")
      } else if (child.type.name === "image") {
        const src = String(child.attrs["src"] ?? "").trim()
        const alt = (String(child.attrs["alt"] ?? "Görsel") || "Görsel").replace(/[[\]]/g, "") || "Görsel"
        if (src) {
          parts.push(`![${alt}](${src})`)
        }
      }
    })
    lines.push(parts.join(""))
  })
  return lines.join("\n")
}

export { INLINE_IMG_CLASS as MESSAGE_INLINE_IMAGE_CLASS }
