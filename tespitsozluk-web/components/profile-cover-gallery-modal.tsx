"use client"

import { useRef } from "react"
import { ImagePlus, Images, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { COVER_CHOICES, DEFAULT_COVER_KEY } from "@/lib/cover-choices"
import { toast } from "sonner"

export type CoverApplyPayload =
  | { kind: "gallery"; coverChoiceKey: string }
  | { kind: "custom"; coverUrl: string }

type ProfileCoverGalleryModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedKey: string | null | undefined
  customCoverUrl: string | null | undefined
  saving: boolean
  onApply: (payload: CoverApplyPayload) => Promise<void>
}

export function ProfileCoverGalleryModal({
  open,
  onOpenChange,
  selectedKey,
  customCoverUrl,
  saving,
  onApply,
}: ProfileCoverGalleryModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)

  const effectiveGalleryKey = customCoverUrl?.trim() ? null : (selectedKey ?? DEFAULT_COVER_KEY)

  async function uploadFile(file: File) {
    const fd = new FormData()
    fd.append("image", file)
    const res = await fetch("/api/upload-imgbb", { method: "POST", body: fd })
    const data: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err =
        typeof data === "object" && data !== null && "error" in data
          ? String((data as { error?: unknown }).error ?? "")
          : ""
      throw new Error(err || "Yükleme başarısız.")
    }
    const url =
      typeof data === "object" && data !== null && "url" in data
        ? (data as { url?: unknown }).url
        : undefined
    if (typeof url !== "string" || !url.trim()) {
      throw new Error("Geçerli görsel adresi alınamadı.")
    }
    await onApply({ kind: "custom", coverUrl: url.trim() })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto border-border bg-card sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Pencil className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            Kapak seç
          </DialogTitle>
          <DialogDescription className="text-left">
            Hazır fotoğraflardan seçin veya galerinizden yükleyin.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="gallery" className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1">
            <TabsTrigger value="gallery" className="gap-1.5 text-xs sm:text-sm">
              <Images className="h-4 w-4 shrink-0 opacity-80" />
              Hazır Fotoğraflar
            </TabsTrigger>
            <TabsTrigger value="upload" className="gap-1.5 text-xs sm:text-sm">
              <ImagePlus className="h-4 w-4 shrink-0 opacity-80" />
              Fotoğraf Yükle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gallery" className="mt-4 space-y-3 outline-none">
            {customCoverUrl?.trim() && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Şu an galerinizden yüklenmiş bir fotoğraf kullanılıyor. Hazır Fotoğraflardan seçim
                yapınca özel kapak kaldırılır.
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {COVER_CHOICES.map((c) => {
                const selected = !customCoverUrl?.trim() && effectiveGalleryKey === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        await onApply({ kind: "gallery", coverChoiceKey: c.id })
                      } catch {
                        /* parent toast */
                      }
                    }}
                    className={cn(
                      "group relative aspect-[3/1] w-full overflow-hidden rounded-lg border-2 bg-muted transition-[border-color,box-shadow]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary ring-2 ring-primary/30 shadow-sm"
                        : "border-transparent hover:border-border",
                    )}
                    title={c.label}
                  >
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                    <span className="sr-only">{c.label}</span>
                    <span
                      className={cn(
                        "absolute bottom-1 left-1 right-1 truncate rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur-sm",
                        "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity",
                        selected && "opacity-100",
                      )}
                    >
                      {c.label}
                    </span>
                    {saving && (
                      <span className="absolute inset-0 flex items-center justify-center bg-background/50 text-xs font-medium">
                        Kaydediliyor…
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-3 outline-none">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ""
                if (!file) return
                try {
                  await uploadFile(file)
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Yükleme başarısız.")
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              className="w-full gap-2 sm:w-auto"
              onClick={() => fileRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4" />
              Fotoğraf yükle
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
