"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import DOMPurify from "isomorphic-dompurify"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
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

function isLightboxNavInteractionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest('[data-lightbox-nav="true"]')
  )
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

  useEffect(() => {
    if (imageLightbox == null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setImageLightbox((prev) => {
          if (!prev || prev.currentIndex <= 0) return prev
          return { ...prev, currentIndex: prev.currentIndex - 1 }
        })
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setImageLightbox((prev) => {
          if (!prev || prev.currentIndex >= prev.images.length - 1) return prev
          return { ...prev, currentIndex: prev.currentIndex + 1 }
        })
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [imageLightbox != null])

  const lightboxSlide =
    imageLightbox &&
    imageLightbox.images[imageLightbox.currentIndex] != null
      ? imageLightbox.images[imageLightbox.currentIndex]
      : null
  const galleryLen = imageLightbox?.images.length ?? 0
  const canPrev =
    imageLightbox != null && imageLightbox.currentIndex > 0
  const canNext =
    imageLightbox != null &&
    imageLightbox.currentIndex < galleryLen - 1

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

      <DialogPrimitive.Root
        open={imageLightbox != null}
        onOpenChange={(open) => {
          if (!open) setImageLightbox(null)
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay
            className={cn(
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/55 backdrop-blur-sm duration-200",
            )}
          />
          <DialogPrimitive.Content
            className={cn(
              "fixed inset-0 z-50 flex max-h-none max-w-none w-screen items-center justify-center border-0 bg-transparent p-0 shadow-none outline-none pointer-events-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
            )}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onPointerDownOutside={(e) => {
              if (isLightboxNavInteractionTarget(e.target)) e.preventDefault()
            }}
            onInteractOutside={(e) => {
              if (isLightboxNavInteractionTarget(e.target)) e.preventDefault()
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              Görsel önizleme
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              ESC veya dışarı tıklayarak kapatabilirsiniz. Birden fazla görselde
              sol ve sağ ok tuşlarıyla gezinebilirsiniz.
            </DialogPrimitive.Description>

            {imageLightbox && lightboxSlide ? (
              <div className="relative inline-flex max-w-[min(calc(100vw-2rem),100vw)] shrink-0 pointer-events-auto">
                <DialogPrimitive.Close
                  type="button"
                  className={cn(
                    "ring-offset-background focus-visible:ring-ring absolute -top-11 right-0 z-[60] flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-md transition-opacity",
                    "hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  )}
                  aria-label="Kapat"
                >
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
                <img
                  key={`${imageLightbox.currentIndex}-${lightboxSlide.src}`}
                  src={lightboxSlide.src}
                  alt={lightboxSlide.alt}
                  className={cn(
                    "max-h-[min(calc(100vh-5rem),100vh)] max-w-full w-auto h-auto object-contain rounded-md shadow-2xl select-none",
                    "animate-in fade-in-0 zoom-in-95 duration-200",
                  )}
                  draggable={false}
                />
              </div>
            ) : null}

            {imageLightbox != null && galleryLen > 1 ? (
              <>
                {canPrev ? (
                  <button
                    type="button"
                    data-lightbox-nav="true"
                    className={cn(
                      "fixed left-4 top-1/2 z-[60] flex -translate-y-1/2 items-center justify-center rounded-full p-3 md:left-10",
                      "pointer-events-auto bg-black/20 text-white/70 transition-all hover:bg-black/60 hover:text-white",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                    )}
                    aria-label="Önceki görsel"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setImageLightbox((prev) => {
                        if (!prev || prev.currentIndex <= 0) return prev
                        return { ...prev, currentIndex: prev.currentIndex - 1 }
                      })
                    }}
                  >
                    <ChevronLeftIcon className="size-6" aria-hidden />
                  </button>
                ) : null}
                {canNext ? (
                  <button
                    type="button"
                    data-lightbox-nav="true"
                    className={cn(
                      "fixed right-4 top-1/2 z-[60] flex -translate-y-1/2 items-center justify-center rounded-full p-3 md:right-10",
                      "pointer-events-auto bg-black/20 text-white/70 transition-all hover:bg-black/60 hover:text-white",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                    )}
                    aria-label="Sonraki görsel"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setImageLightbox((prev) => {
                        if (!prev || prev.currentIndex >= prev.images.length - 1)
                          return prev
                        return { ...prev, currentIndex: prev.currentIndex + 1 }
                      })
                    }}
                  >
                    <ChevronRightIcon className="size-6" aria-hidden />
                  </button>
                ) : null}
              </>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}
