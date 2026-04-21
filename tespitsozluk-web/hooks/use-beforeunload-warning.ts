"use client"

import { useEffect } from "react"

/** Sekme kapatma / yenileme için tarayıcının yerleşik uyarısı (modern tarayıcılarda genel mesaj). */
export function useBeforeunloadWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [active])
}
