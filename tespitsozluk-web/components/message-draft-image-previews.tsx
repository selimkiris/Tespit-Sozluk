"use client"

import { useMemo } from "react"
import { X } from "lucide-react"
import { listMarkdownImages, removeMarkdownImageAtIndex } from "@/lib/messaging-markdown"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const THUMB =
  "h-12 w-12 rounded-md object-cover border border-border/50 bg-muted/30"

type MessageDraftImagePreviewsProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  className?: string
}

/**
 * Entry’de depolanan `![alt](url)` ile aynı format; taslak alanında satır altı
 * küçük kare önizlemeler (görüntü yalnızca UI — gönderim metni değişmez).
 */
export function MessageDraftImagePreviews({
  value,
  onChange,
  disabled,
  className,
}: MessageDraftImagePreviewsProps) {
  const images = useMemo(() => listMarkdownImages(value), [value])
  if (images.length === 0) return null

  return (
    <div
      className={cn(
        "flex flex-wrap gap-2 border-t border-border/60 bg-muted/15 px-2 py-2",
        className,
      )}
    >
      {images.map((img, i) => (
        <div
          key={`${i}-${img.src}`}
          className="group relative h-12 w-12 shrink-0"
        >
          <img
            src={img.src}
            alt={img.alt}
            className={THUMB}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          {!disabled && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full border border-border/80 p-0 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              onClick={() => onChange(removeMarkdownImageAtIndex(value, i))}
              title="Görseli kaldır"
              aria-label="Görseli kaldır"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
    </div>
  )
}
