"use client"

import { useEffect, useRef } from "react"

/**
 * Aynı site içi `<a href>` tıklamalarını yakalar; `active` iken navigasyonu iptal edip callback verir.
 * (Next.js App Router’da `routeChangeStart` olmadığı için capture-phase click kullanılır.)
 */
export function useInternalNavigationGuard(
  active: boolean,
  onAttempt: (pathnameWithSearch: string) => void,
) {
  const onAttemptRef = useRef(onAttempt)
  onAttemptRef.current = onAttempt

  useEffect(() => {
    if (!active) return

    const handler = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const el = (e.target as HTMLElement | null)?.closest?.("a[href]")
      if (!el) return

      if (el.getAttribute("download") != null) return
      if (el.getAttribute("target") === "_blank") return

      const hrefAttr = el.getAttribute("href")
      if (
        !hrefAttr ||
        hrefAttr.startsWith("#") ||
        hrefAttr.startsWith("javascript:") ||
        hrefAttr.startsWith("mailto:") ||
        hrefAttr.startsWith("tel:")
      ) {
        return
      }

      let nextUrl: URL
      try {
        nextUrl = new URL(hrefAttr, window.location.origin)
      } catch {
        return
      }

      if (nextUrl.origin !== window.location.origin) return

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      if (next === current) return

      e.preventDefault()
      e.stopPropagation()
      onAttemptRef.current(next)
    }

    document.addEventListener("click", handler, true)
    return () => document.removeEventListener("click", handler, true)
  }, [active])
}
