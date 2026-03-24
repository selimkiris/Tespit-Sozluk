"use client"

import { useState, useEffect, useMemo } from "react"
import { HtmlRenderer } from "@/components/html-renderer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getHtmlPlainTextLength, truncateHtmlByTextLength } from "@/lib/truncate-html"

interface ExpandableHtmlContentProps {
  html: string
  className?: string
  rendererClassName?: string
  maxChars?: number
}

export function ExpandableHtmlContent({
  html,
  className,
  rendererClassName,
  maxChars = 750,
}: ExpandableHtmlContentProps) {
  const [expanded, setExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setExpanded(false)
  }, [html])

  const plainLen = useMemo(() => getHtmlPlainTextLength(html), [html])
  const needsReadMore = plainLen > maxChars

  const truncatedHtml = useMemo(() => {
    if (!mounted || !needsReadMore || expanded) return null
    return truncateHtmlByTextLength(html, maxChars)
  }, [html, mounted, needsReadMore, expanded, maxChars])

  const showHtml =
    expanded || !needsReadMore || !mounted ? html : truncatedHtml ?? html

  return (
    <div className={cn("min-w-0 w-full max-w-full overflow-x-hidden", className)}>
      <div
        className={cn(
          "entry-text min-w-0 w-full max-w-full",
          !expanded && needsReadMore && mounted && "relative"
        )}
      >
        <HtmlRenderer html={showHtml} className={rendererClassName} />
      </div>
      {needsReadMore && mounted && (
        <div className="mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="entry-read-more-link h-auto px-0 py-0 text-[#8a8d96] italic text-sm hover:text-[#a0a3ab] transition-colors duration-150 hover:bg-transparent"
            style={{ color: '#8a8d96', fontStyle: 'italic', fontSize: '14px' }}
            onClick={() => setExpanded((e) => !e)}
          >
            {expanded ? "Daralt" : "Devamını oku"}
          </Button>
        </div>
      )}
    </div>
  )
}
