"use client"

import { useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ImageLightboxSlide = { src: string; alt: string }

export type ImageLightboxState = {
  images: ImageLightboxSlide[]
  currentIndex: number
} | null

function isLightboxNavInteractionTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-lightbox-nav="true"]')
}

type EntryImageLightboxDialogProps = {
  value: ImageLightboxState
  onOpenChange: (open: boolean) => void
  onIndexChange: (index: number) => void
  /** Modalın üst katmanlarda açılması (sohbet üstü) için, ör. `z-[200]`. */
  zOverlayClassName?: string
  zContentClassName?: string
}

/**
 * Entry ve HTML gövdedeki inline görsellerle aynı tam ekran / zoom (lightbox) deneyimi.
 * `html-renderer` ve sohbet balonları tarafından paylaşılır.
 */
export function EntryImageLightboxDialog({
  value,
  onOpenChange,
  onIndexChange,
  zOverlayClassName = "z-50",
  zContentClassName = "z-50",
}: EntryImageLightboxDialogProps) {
  const open = value != null
  const len = value?.images.length ?? 0
  const currentIndex = value?.currentIndex ?? 0
  const slide = value?.images?.[currentIndex] ?? null
  const canPrev = open && currentIndex > 0
  const canNext = open && currentIndex < len - 1

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && canPrev) {
        e.preventDefault()
        onIndexChange(currentIndex - 1)
      } else if (e.key === "ArrowRight" && canNext) {
        e.preventDefault()
        onIndexChange(currentIndex + 1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, canPrev, canNext, currentIndex, onIndexChange])

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/55 backdrop-blur-sm duration-200",
            zOverlayClassName,
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 flex max-h-none max-w-none w-screen items-center justify-center overflow-visible border-0 bg-transparent p-6 shadow-none outline-none pointer-events-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200",
            zContentClassName,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            if (isLightboxNavInteractionTarget(e.target)) e.preventDefault()
          }}
          onInteractOutside={(e) => {
            if (isLightboxNavInteractionTarget(e.target)) e.preventDefault()
          }}
        >
          <DialogPrimitive.Title className="sr-only">Görsel önizleme</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            ESC veya dışarı tıklayarak kapatabilirsiniz. Birden fazla görselde sol ve sağ ok tuşlarıyla
            gezinebilirsiniz.
          </DialogPrimitive.Description>

          {value && slide ? (
            <div className="relative inline-flex shrink-0 overflow-visible max-w-[min(calc(100vw-3rem),100vw)] pointer-events-auto">
              <DialogPrimitive.Close
                type="button"
                className={cn(
                  "absolute -top-3 -right-3 z-[60] flex items-center justify-center rounded-full bg-white p-1.5 text-gray-800 shadow-md",
                  "transition hover:scale-105 hover:bg-gray-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2",
                )}
                aria-label="Kapat"
              >
                <XIcon className="size-4 shrink-0" />
              </DialogPrimitive.Close>
              <img
                key={`${currentIndex}-${slide.src}`}
                src={slide.src}
                alt={slide.alt}
                className={cn(
                  "max-h-[min(calc(100vh-5rem),100vh)] max-w-full w-auto h-auto object-contain rounded-md shadow-2xl select-none",
                  "animate-in fade-in-0 zoom-in-95 duration-200",
                )}
                draggable={false}
              />
            </div>
          ) : null}

          {open && len > 1 ? (
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
                    onIndexChange(currentIndex - 1)
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
                    onIndexChange(currentIndex + 1)
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
  )
}
