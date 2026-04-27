"use client"

import { useCallback, useRef, useState } from "react"
import { Image as ImageIcon, Loader2, Smile } from "lucide-react"
import data from "@emoji-mart/data"
import Picker from "@emoji-mart/react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type MessageTextareaToolbarProps = {
  onInsert: (text: string) => void
  disabled?: boolean
  /**
   * Entry gövde editörüyle uyum: üst barda bitişik şerit.
   * `true` = alt köşe yuvarlama yok, üst çizgi ile `textarea` ayrımı.
   */
  attachedAboveTextarea?: boolean
  /** Sohbet girişi: çerçevesiz, ince, şeffaf arka plan */
  variant?: "default" | "compact"
  className?: string
}

/**
 * Mesaj alanları için: `RichTextEditor` ile aynı emoji + imgbb yükleme;
 * düz `textarea` içine `![Görsel](url)` (entry ile uyumlu) ekler.
 * URL ile görsel ekleme yalnızca entry editöründe; burada sadece dosya.
 */
export function MessageTextareaToolbar({
  onInsert,
  disabled,
  attachedAboveTextarea = false,
  variant = "default",
  className,
}: MessageTextareaToolbarProps) {
  const isCompact = variant === "compact"
  const { resolvedTheme } = useTheme()
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [imageOpen, setImageOpen] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadBatchTotal, setImageUploadBatchTotal] = useState(0)
  const imageFileInputRef = useRef<HTMLInputElement>(null)

  const openImage = useCallback(() => {
    setImageUploading(false)
    setImageUploadBatchTotal(0)
    setImageOpen(true)
  }, [])

  const closeImage = useCallback(() => {
    if (imageUploading) return
    setImageOpen(false)
  }, [imageUploading])

  const handleImageFilesSelected = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"))
      if (imageFiles.length === 0) {
        toast.error("Lütfen en az bir görsel dosyası seçin.")
        return
      }
      setImageUploading(true)
      setImageUploadBatchTotal(imageFiles.length)
      try {
        const urls = (
          await Promise.all(
            imageFiles.map(async (file) => {
              try {
                const fd = new FormData()
                fd.append("image", file)
                const res = await fetch("/api/upload-imgbb", {
                  method: "POST",
                  body: fd,
                })
                const j: unknown = await res.json().catch(() => ({}))
                if (!res.ok) return null
                const url =
                  typeof j === "object" && j !== null && "url" in j
                    ? (j as { url?: unknown }).url
                    : undefined
                if (typeof url !== "string" || !url.trim()) return null
                return url.trim()
              } catch {
                return null
              }
            }),
          )
        ).filter((u): u is string => u != null)

        if (urls.length === 0) {
          toast.error("Görseller yüklenemedi.")
          return
        }
        if (urls.length < imageFiles.length) {
          toast.warning("Bazı görseller yüklenemedi.")
        }
        const markdown = urls.map((u) => `![Görsel](${u})`).join(" ")
        onInsert(`${markdown} `)
        closeImage()
      } catch {
        toast.error("Görsel yüklenemedi.")
      } finally {
        setImageUploading(false)
        setImageUploadBatchTotal(0)
      }
    },
    [closeImage, onInsert],
  )

  const onImageFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawFiles = e.target.files
      if (!rawFiles) return
      const filesArray = Array.from(rawFiles)
      e.target.value = ""
      void handleImageFilesSelected(filesArray)
    },
    [handleImageFilesSelected],
  )

  const onImageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (imageUploading) return
      const rawFiles = e.dataTransfer.files
      if (!rawFiles) return
      void handleImageFilesSelected(Array.from(rawFiles))
    },
    [handleImageFilesSelected, imageUploading],
  )

  const insertEmoji = useCallback(
    (emoji: { native?: string }) => {
      if (!emoji.native) return
      onInsert(emoji.native)
      setEmojiOpen(false)
    },
    [onInsert],
  )

  const emojiTheme = resolvedTheme === "dark" ? "dark" : "light"

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-0.5",
        isCompact
          ? "border-0 bg-transparent px-0.5 py-0.5"
          : cn(
              "border-border px-1 py-1.5",
              "bg-gray-100 dark:bg-[#2b2d2e]",
              attachedAboveTextarea ? "rounded-t-md border-b" : "rounded-md border",
            ),
        className,
      )}
    >
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        disabled={disabled || imageUploading}
        onChange={onImageFileInputChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn("shrink-0", isCompact ? "h-7 w-7" : "h-8 w-8")}
        title="Fotoğraf ekle (cihazdan)"
        disabled={disabled}
        onClick={openImage}
      >
        <ImageIcon className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </Button>
      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("shrink-0", isCompact ? "h-7 w-7" : "h-8 w-8")}
            title="Emoji"
            disabled={disabled}
          >
            <Smile className={isCompact ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[200] w-auto border-0 p-0"
          align="start"
          onWheelCapture={(e) => e.stopPropagation()}
        >
          <Picker
            data={data}
            onEmojiSelect={insertEmoji}
            theme={emojiTheme}
            previewPosition="none"
          />
        </PopoverContent>
      </Popover>

      <Dialog
        open={imageOpen}
        onOpenChange={(o) => {
          if (!o) closeImage()
        }}
      >
        <DialogContent
          className="z-[200] max-h-[min(80vh,520px)] gap-3 overflow-y-auto p-4 sm:max-w-sm"
          showCloseButton={!imageUploading}
          onPointerDownOutside={(e) => {
            if (imageUploading) e.preventDefault()
          }}
          onEscapeKeyDown={(e) => {
            if (imageUploading) e.preventDefault()
          }}
        >
          <DialogHeader className="space-y-0 pb-0">
            <DialogTitle className="text-base">Fotoğraf ekle</DialogTitle>
          </DialogHeader>
          <div
            role="presentation"
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={onImageDrop}
            className={cn(
              "rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground transition-colors",
              imageUploading && "pointer-events-none opacity-70",
            )}
          >
            {imageUploading ? (
              <p className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                {imageUploadBatchTotal > 1
                  ? `${imageUploadBatchTotal} fotoğraf yükleniyor…`
                  : "Yükleniyor…"}
              </p>
            ) : (
              <>
                <p className="mb-2 leading-snug">
                  Görselleri buraya sürükleyip bırakın veya cihazdan seçin.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={imageUploading}
                  onClick={() => imageFileInputRef.current?.click()}
                >
                  Cihazdan seç
                </Button>
              </>
            )}
          </div>
          <DialogFooter className="mt-2 gap-2 sm:mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={imageUploading}
              onClick={closeImage}
            >
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
