"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import DOMPurify from "isomorphic-dompurify"
import { EntryImageLightboxDialog } from "@/components/entry-image-lightbox-dialog"
import { cn } from "@/lib/utils"
import {
  applyBkzLinks,
  applyMarkdownImages,
  applyMentionLinks,
} from "@/lib/entry-body-link-transforms"
import {
  highlightSearchInEntryHtml,
  shouldApplyEntrySearchHighlight,
} from "@/lib/search-highlight-html"

function isEntryInlineImageLightboxAnchor(a: HTMLAnchorElement): boolean {
  const imgs = a.querySelectorAll("img")
  if (imgs.length !== 1) return false
  const href = a.getAttribute("href")
  const src = imgs[0].getAttribute("src")
  if (
    !href ||
    !src ||
    href !== src ||
    !/^https?:\/\//i.test(href)
  ) {
    return false
  }
  if (a.getAttribute("data-entry-image-lightbox")) return true
  return a.getAttribute("target") === "_blank"
}

/** Harf veya rakam içeriyorsa “anlamlı metin” sayılır (spoiler / yazı sınırı). */
function hasMeaningfulTextContent(raw: string): boolean {
  return /[\p{L}\p{N}]/u.test(raw)
}

/**
 * Aynı ebeveyn altında, aralarında yalnızca anlamsız ayraç (boşluk, noktalama, <br>) olan
 * peş peşe lightbox görsellerini toplar; yazı veya başka HTML bloğu gruplamayı keser.
 */
function isIgnorableBetweenLightboxPeers(node: ChildNode): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    return !hasMeaningfulTextContent(node.textContent ?? "")
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return (node as Element).tagName === "BR"
  }
  return false
}

function collectConsecutiveLightboxAnchorsFrom(
  clicked: HTMLAnchorElement,
): HTMLAnchorElement[] {
  const parent = clicked.parentNode
  if (!parent) return [clicked]

  const before: HTMLAnchorElement[] = []
  let n: ChildNode | null = clicked.previousSibling
  while (n) {
    if (n instanceof HTMLAnchorElement && isEntryInlineImageLightboxAnchor(n)) {
      before.unshift(n)
      n = n.previousSibling
      continue
    }
    if (isIgnorableBetweenLightboxPeers(n)) {
      n = n.previousSibling
      continue
    }
    break
  }

  const after: HTMLAnchorElement[] = []
  n = clicked.nextSibling
  while (n) {
    if (n instanceof HTMLAnchorElement && isEntryInlineImageLightboxAnchor(n)) {
      after.push(n)
      n = n.nextSibling
      continue
    }
    if (isIgnorableBetweenLightboxPeers(n)) {
      n = n.nextSibling
      continue
    }
    break
  }

  return [...before, clicked, ...after]
}

function collectLightboxGalleryForAnchor(
  clicked: HTMLAnchorElement,
): { images: { src: string; alt: string }[]; currentIndex: number } {
  const anchors = collectConsecutiveLightboxAnchorsFrom(clicked)
  const images = anchors.map((a) => {
    const href = a.getAttribute("href") ?? ""
    const img = a.querySelector("img")
    const alt = (img?.getAttribute("alt") ?? "").trim() || "Görsel"
    return { src: href, alt }
  })
  const currentIndex = Math.max(0, anchors.indexOf(clicked))
  return { images, currentIndex }
}

function resolveInlineImageLightboxAnchor(
  root: HTMLElement,
  target: Element,
): HTMLAnchorElement | null {
  const a = target.closest("a")
  if (!a || !(a instanceof HTMLAnchorElement) || !root.contains(a)) return null
  if (!isEntryInlineImageLightboxAnchor(a)) return null
  const href = a.getAttribute("href")
  if (!href || !/^https?:\/\//i.test(href)) return null
  return a
}

interface HtmlRendererProps {
  html: string
  className?: string
  /** Başlık içi arama vb.: yalnızca metin düğümlerinde vurgu (istemci mount sonrası). */
  searchHighlightQuery?: string
}

export function HtmlRenderer({ html, className, searchHighlightQuery }: HtmlRendererProps) {
  const router = useRouter()
  const rootRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)
  const [imageLightbox, setImageLightbox] = useState<{
    images: { src: string; alt: string }[]
    currentIndex: number
  } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const sanitized = useMemo(() => {
    const withMentions = applyMentionLinks(html)
    const withBkz = applyBkzLinks(withMentions)
    const withImages = applyMarkdownImages(withBkz)
    return DOMPurify.sanitize(withImages, {
      ALLOWED_TAGS: [
        "p", "br", "strong", "em", "s", "u", "a",
        "ul", "ol", "li", "blockquote",
        "img", "span", "div", "mark",
        "iframe",
      ],
      ALLOWED_ATTR: [
        "href", "target", "rel", "class",
        "src", "alt", "title", "width", "height",
        "allowfullscreen", "frameborder", "allow",
      ],
      ADD_ATTR: ["data-profile-link", "data-entry-image-lightbox"],
      ALLOW_DATA_ATTR: false,
    })
  }, [html])

  const displayHtml = useMemo(() => {
    if (!mounted || !shouldApplyEntrySearchHighlight(searchHighlightQuery)) {
      return sanitized
    }
    return highlightSearchInEntryHtml(sanitized, searchHighlightQuery!.trim())
  }, [mounted, sanitized, searchHighlightQuery])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element)) return

      const anchor = resolveInlineImageLightboxAnchor(root, t)
      if (anchor) {
        e.preventDefault()
        setImageLightbox(collectLightboxGalleryForAnchor(anchor))
        return
      }

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
  }, [displayHtml, router])

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "prose prose-sm sm:prose-base dark:prose-invert dark:text-gray-100 max-w-none min-w-0 text-foreground",
          "break-words whitespace-pre-wrap overflow-x-hidden w-full max-w-full",
          "prose-p:my-0 prose-p:py-0 prose-p:break-words prose-a:text-emerald-500 prose-a:font-medium prose-a:no-underline prose-a:underline-offset-2 prose-a:hover:underline",
          "prose-img:!my-0 prose-img:!mb-0 prose-img:!mt-0",
          "[&_img]:!m-0 [&_img]:!my-0 [&_a:has(img)]:!inline [&_a:has(img)]:!m-0 [&_a:has(img)]:align-middle",
          "[&_p]:!my-0 [&_p]:!py-0 [&_strong]:text-inherit [&_b]:text-inherit",
          className
        )}
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />

      <EntryImageLightboxDialog
        value={imageLightbox}
        onOpenChange={(o) => {
          if (!o) setImageLightbox(null)
        }}
        onIndexChange={(idx) =>
          setImageLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))
        }
      />
    </>
  )
}
