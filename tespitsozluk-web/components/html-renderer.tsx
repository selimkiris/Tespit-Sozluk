"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { cn } from "@/lib/utils"

/**
 * Backend'in doğruladığı @mention kalıbı: [@kullaniciadi](/user/{guid})
 * Geçersiz @ kullanımları düz metin kalır; bu regex sadece çözümlenenleri yakalar.
 * Sanitize etmeden ÖNCE uygulanır.
 */
function applyMentionLinks(html: string): string {
  return html.replace(
    /\[@([^\]]+)\]\(\/user\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)/gi,
    (_, username: string, userId: string) =>
      `<a href="/user/${userId}" data-profile-link="1" class="text-emerald-500 font-medium hover:underline">@${escapeHtmlText(username)}</a>`
  )
}

function escapeHtmlText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * (bkz: kelime) kalıplarını arama linkine çevirir.
 * Sanitize etmeden ÖNCE uygulanır.
 */
function applyBkzLinks(html: string): string {
  return html.replace(
    /\(bkz:\s*([^)]+)\)/gi,
    (_, kelime) =>
      `<a href="/?search=${encodeURIComponent(kelime.trim())}" class="text-emerald-500 font-medium hover:underline">(bkz: ${kelime.trim()})</a>`
  )
}

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
        "prose-p:break-words prose-a:text-emerald-500 prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
        "[&_strong]:text-inherit [&_b]:text-inherit",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
