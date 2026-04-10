"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"
import { applyBkzLinks, applyMentionLinks } from "@/lib/entry-body-link-transforms"

interface HtmlRendererProps {
  html: string
  className?: string
}

export function HtmlRenderer({ html, className }: HtmlRendererProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)

  const withMentions = applyMentionLinks(html)
  const withBkz = applyBkzLinks(withMentions)
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
    ADD_ATTR: ["data-profile-link"],
    ALLOW_DATA_ATTR: false,
  })

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const a = t.closest("a[data-profile-link]")
      if (!a || !root.contains(a)) return
      const href = a.getAttribute("href")
      if (!href?.startsWith("/user/")) return
      e.preventDefault()
      router.push(href)
    }

    const onPointerEnter = (e: Event) => {
      const t = e.target
      if (!(t instanceof Element)) return
      const a = t.closest("a[data-profile-link]")
      if (!a || !root.contains(a)) return
      const href = a.getAttribute("href")
      if (href?.startsWith("/user/")) router.prefetch(href)
    }

    root.addEventListener("click", onClick)
    root.addEventListener("pointerenter", onPointerEnter, true)
    return () => {
      root.removeEventListener("click", onClick)
      root.removeEventListener("pointerenter", onPointerEnter, true)
    }
  }, [sanitized, router])

  return (
    <div
      ref={rootRef}
      className={cn(
        "prose prose-sm sm:prose-base dark:prose-invert dark:text-gray-100 max-w-none min-w-0 text-foreground",
        "break-words whitespace-pre-wrap overflow-x-hidden w-full max-w-full",
        "prose-p:my-0 prose-p:py-0 prose-p:break-words prose-a:text-emerald-500 prose-a:font-medium prose-a:no-underline prose-a:underline-offset-2 prose-a:hover:underline",
        "[&_p]:!my-0 [&_p]:!py-0 [&_strong]:text-inherit [&_b]:text-inherit",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
