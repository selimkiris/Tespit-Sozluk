"use client"

import { useEffect, useRef } from "react"
import type { Editor } from "@tiptap/core"
import { scanDocForPatternSpans } from "@/lib/entry-pattern-scan"
import { resolveExistsWithCache, type ExistsLookupResult } from "@/lib/editor-exists-api"
import { buildLinkDecisions, applyPatternLinkDecisions } from "@/lib/entry-pattern-reconcile"

const DEBOUNCE_MS = 420

/**
 * (bkz:) ve @mention için debounce + önbellek + API doğrulaması; yalnızca var olan kayıtlar yeşil linklenir.
 */
export function useEntryPatternExistsValidation(editor: Editor | null) {
  const cacheRef = useRef<Map<string, ExistsLookupResult>>(new Map())
  const genRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!editor) return

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => void run(), DEBOUNCE_MS)
    }

    const run = async () => {
      const myGen = ++genRef.current
      const spans = scanDocForPatternSpans(editor.state.doc)
      const uniqueByKey = new Map<string, (typeof spans)[0]>()
      for (const s of spans) {
        if (!uniqueByKey.has(s.cacheKey)) uniqueByKey.set(s.cacheKey, s)
      }

      await Promise.all(
        [...uniqueByKey.values()].map((s) => resolveExistsWithCache(s.kind, s.raw, cacheRef.current))
      )

      if (myGen !== genRef.current) return
      if (editor.isDestroyed) return

      const spansNow = scanDocForPatternSpans(editor.state.doc)
      const decisions = buildLinkDecisions(spansNow, cacheRef.current)
      applyPatternLinkDecisions(editor, decisions)
    }

    editor.on("update", schedule)
    queueMicrotask(() => void run())

    return () => {
      editor.off("update", schedule)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [editor])
}
