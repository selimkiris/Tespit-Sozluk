import type { Editor } from "@tiptap/core"
import type { ScannedPatternSpan } from "@/lib/entry-pattern-scan"
import type { ExistsLookupResult } from "@/lib/editor-exists-api"
import { hrefForAtUsername, hrefForBkzTerm, hrefForBkzTopicId } from "@/lib/editor-link-href"

export type SpanLinkDecision = {
  from: number
  to: number
  applyLink: boolean
  href?: string
}

function hrefForSpan(span: ScannedPatternSpan, ex: ExistsLookupResult): string | undefined {
  if (!ex.exists) return undefined
  if (span.kind === "bkz") {
    if (ex.topicId) return hrefForBkzTopicId(ex.topicId)
    return hrefForBkzTerm(span.raw)
  }
  if (ex.userId) return `/user/${ex.userId}`
  return hrefForAtUsername(span.raw)
}

export function buildLinkDecisions(
  spans: ScannedPatternSpan[],
  results: Map<string, ExistsLookupResult>
): SpanLinkDecision[] {
  const decisions: SpanLinkDecision[] = []
  for (const span of spans) {
    const ex = results.get(span.cacheKey) ?? { exists: false }
    const href = hrefForSpan(span, ex)
    decisions.push({
      from: span.from,
      to: span.to,
      applyLink: !!href,
      href,
    })
  }
  return decisions.sort((a, b) => b.from - a.from)
}

/**
 * Sadece taranan aralıklarda link ekle/kaldır; http(s) gibi diğer linklere dokunmaz.
 */
export function applyPatternLinkDecisions(editor: Editor, decisions: SpanLinkDecision[]): void {
  const linkType = editor.schema.marks.link
  if (!linkType) return

  editor.commands.command(({ tr, dispatch }) => {
    if (!dispatch) return false

    for (const d of decisions) {
      if (d.from >= d.to) continue
      tr.removeMark(d.from, d.to, linkType)
      if (d.applyLink && d.href) {
        tr.addMark(
          d.from,
          d.to,
          linkType.create({
            href: d.href,
            target: "_blank",
            rel: "noopener noreferrer",
            class: "text-emerald-600 dark:text-emerald-400 hover:underline",
          })
        )
      }
    }

    return tr.steps.length > 0
  })
}
