"use client"

import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"

/**
 * (bkz: kelime) kalıplarını arama linkine çevirir.
 * Sanitize etmeden ÖNCE uygulanır.
 */
function applyBkzLinks(html: string): string {
  return html.replace(
    /\(bkz:\s*([^)]+)\)/gi,
    (_, kelime) =>
      `<a href="/?search=${encodeURIComponent(kelime.trim())}" class="text-green-600 dark:text-green-400 hover:underline">(bkz: ${kelime.trim()})</a>`
  )
}

interface HtmlRendererProps {
  html: string
  className?: string
}

export function HtmlRenderer({ html, className }: HtmlRendererProps) {
  const withBkz = applyBkzLinks(html)
  const sanitized = DOMPurify.sanitize(withBkz, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "s", "u", "a",
      "ul", "ol", "li", "blockquote",
      "img", "span", "div",
      "iframe",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "class",
      "src", "alt", "title", "width", "height",
      "allowfullscreen", "frameborder", "allow",
    ],
    ALLOW_DATA_ATTR: false,
  })

  return (
    <div
      className={cn("prose prose-sm sm:prose-base dark:prose-invert dark:text-gray-100 max-w-none text-foreground", className)}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
