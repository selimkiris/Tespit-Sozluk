"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { ImageIcon } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import { HYBRID_AVATAR_COUNT, HYBRID_AVATAR_URLS } from "@/lib/avatar-data"
import { isSystemAvatarUrl } from "@/lib/system-avatars"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { z } from "zod"

const avatarExternalUrlSchema = z.string().url({
  message: "Geçerli bir görsel bağlantısı girin.",
})

interface AvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar?: string | null
  onAvatarUpdate?: (avatar: string | null) => void
}

/** BBCode / HTML içinden doğrudan görsel adresi ayıklar. */
const DIRECT_IMAGE_URL_IN_TEXT_RE =
  /(https?:\/\/[^\s"'<>\[\]]+\.(?:jpg|jpeg|png|gif|webp))/i

/** ImgBB "viewer" kısa bağlantısı (sayfa URL'si, doğrudan dosya değil). */
const IBB_VIEWER_SHORT_RE = /^https?:\/\/(?:www\.)?ibb\.co\/[a-zA-Z0-9]+\/?$/i

const HYBRID_PAGE_SIZE = 140

function isIbBbViewerShortLink(url: string): boolean {
  return IBB_VIEWER_SHORT_RE.test(url.trim())
}

function normalizeExternalAvatarUrlInput(raw: string): string {
  const extracted = raw.match(DIRECT_IMAGE_URL_IN_TEXT_RE)?.[0]
  return extracted ?? raw
}

export function AvatarDialog({
  open,
  onOpenChange,
  currentAvatar,
  onAvatarUpdate,
}: AvatarDialogProps) {
  const [saving, setSaving] = useState(false)
  const [selectedSystemUrl, setSelectedSystemUrl] = useState<string | null>(null)
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [ibbResolving, setIbbResolving] = useState(false)
  const [hybridVisible, setHybridVisible] = useState(HYBRID_PAGE_SIZE)
  const avatarUrlInputRef = useRef(avatarUrlInput)
  const skipShortLinkDebounceRef = useRef(false)

  avatarUrlInputRef.current = avatarUrlInput

  const resolveIbBbShortLink = useCallback(async (shortUrl: string) => {
    const trimmed = shortUrl.trim()
    if (!isIbBbViewerShortLink(trimmed)) return
    setIbbResolving(true)
    try {
      const res = await fetch(
        `/api/parse-imgbb?url=${encodeURIComponent(trimmed)}`,
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data?.error === "string" ? data.error : "ImgBB bağlantısı çözülemedi.",
        )
      }
      const direct = typeof data?.url === "string" ? data.url : ""
      if (!direct) throw new Error("Geçersiz yanıt.")
      setAvatarUrlInput(direct)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ImgBB bağlantısı çözülemedi.")
    } finally {
      setIbbResolving(false)
    }
  }, [])

  useEffect(() => {
    const trimmed = avatarUrlInput.trim()
    if (!isIbBbViewerShortLink(trimmed)) return

    if (skipShortLinkDebounceRef.current) {
      skipShortLinkDebounceRef.current = false
      return
    }

    const id = window.setTimeout(() => {
      const current = avatarUrlInputRef.current.trim()
      if (!isIbBbViewerShortLink(current)) return
      void resolveIbBbShortLink(current)
    }, 500)

    return () => window.clearTimeout(id)
  }, [avatarUrlInput, resolveIbBbShortLink])

  useEffect(() => {
    if (!open) setIbbResolving(false)
  }, [open])

  useEffect(() => {
    if (!open) {
      setHybridVisible(HYBRID_PAGE_SIZE)
      return
    }
    const cur = currentAvatar?.trim() ?? ""
    const isHttp = cur.startsWith("http://") || cur.startsWith("https://")
    let nextHybridVisible = HYBRID_PAGE_SIZE
    if (isHttp) {
      if (isSystemAvatarUrl(cur)) {
        setSelectedSystemUrl(cur)
        setAvatarUrlInput("")
        const idx = HYBRID_AVATAR_URLS.indexOf(cur)
        if (idx >= 0) {
          nextHybridVisible = Math.min(
            HYBRID_AVATAR_COUNT,
            Math.ceil((idx + 1) / HYBRID_PAGE_SIZE) * HYBRID_PAGE_SIZE,
          )
        }
      } else {
        setAvatarUrlInput(cur)
        setSelectedSystemUrl(null)
      }
    } else {
      setSelectedSystemUrl(null)
      setAvatarUrlInput("")
    }
    setHybridVisible(nextHybridVisible)
  }, [open, currentAvatar])

  const saveAvatar = async (url: string | null) => {
    setSaving(true)
    try {
      const res = await apiFetch(getApiUrl("api/Users/settings/avatar"), {
        method: "PUT",
        body: JSON.stringify({ avatarUrl: url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message ?? "Profil fotoğrafı güncellenemedi.")
      const next = typeof data?.avatar === "string" || data?.avatar === null ? data.avatar : url
      onAvatarUpdate?.(next ?? null)
      toast.success(url ? "Profil fotoğrafı güncellendi." : "Profil fotoğrafı kaldırıldı.")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Profil fotoğrafı güncellenemedi.")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSystem = () => {
    if (!selectedSystemUrl) {
      toast.error("Listeden bir avatar seçin.")
      return
    }
    void saveAvatar(selectedSystemUrl)
  }

  const handleSaveUrl = () => {
    if (ibbResolving) return
    const trimmed = avatarUrlInput.trim()
    if (!trimmed) {
      void saveAvatar(null)
      return
    }
    const parsed = avatarExternalUrlSchema.safeParse(trimmed)
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message ?? "Geçerli bir görsel bağlantısı girin."
      toast.error(msg)
      return
    }
    void saveAvatar(parsed.data)
  }

  const handlePrimarySave = () => {
    const trimmed = avatarUrlInput.trim()
    if (trimmed) {
      handleSaveUrl()
    } else if (selectedSystemUrl) {
      handleSaveSystem()
    } else {
      void saveAvatar(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,860px)] flex-col gap-6 overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Profil fotoğrafı
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
          <div className="flex flex-col gap-4">
            <div className="text-sm leading-relaxed text-muted-foreground">
              <span>
                Görselinizi{" "}
                <a
                  href="https://imgbb.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  imgbb.com
                </a>
                &apos;a yükleyin. Gömme kodları bölümünden &quot;BBCode (tam görünüm bağlantısı)&quot;
                seçeneğini seçin ve linkini buraya yapıştırın.
              </span>
            </div>

            <div className="space-y-2">
              <label htmlFor="avatar-url" className="text-sm font-medium">
                Dış bağlantı (URL)
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="avatar-url"
                  type="url"
                  autoComplete="off"
                  className="min-w-0 flex-1"
                  placeholder={
                    ibbResolving ? "Yükleniyor..." : "https://i.ibb.co/.../resim.jpg veya ibb.co/…"
                  }
                  value={ibbResolving ? "Yükleniyor..." : avatarUrlInput}
                  disabled={ibbResolving}
                  onChange={(e) =>
                    setAvatarUrlInput(normalizeExternalAvatarUrlInput(e.target.value))
                  }
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text/plain")
                    const trimmed = text.trim()
                    const extracted = text.match(DIRECT_IMAGE_URL_IN_TEXT_RE)?.[0]
                    if (extracted && trimmed !== extracted) {
                      e.preventDefault()
                      setAvatarUrlInput(extracted)
                      return
                    }
                    if (isIbBbViewerShortLink(trimmed)) {
                      e.preventDefault()
                      skipShortLinkDebounceRef.current = true
                      setAvatarUrlInput(trimmed)
                      void resolveIbBbShortLink(trimmed)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !ibbResolving) handlePrimarySave()
                  }}
                />
                <Button
                  type="button"
                  className="shrink-0 sm:min-w-[7.5rem]"
                  onClick={handlePrimarySave}
                  disabled={saving || ibbResolving}
                >
                  {saving ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    "Kaydet"
                  )}
                </Button>
              </div>
            </div>

            {!ibbResolving &&
              avatarExternalUrlSchema.safeParse(avatarUrlInput.trim()).success && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Önizleme:</span>
                  <img
                    src={avatarUrlInput.trim()}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 rounded-full border border-border/60 object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = "none"
                    }}
                  />
                </div>
              )}
          </div>

          <Separator className="bg-border" />

          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold tracking-tight">Sistem Avatarları</h3>
              <p className="text-xs text-muted-foreground">
                {HYBRID_AVATAR_COUNT} hazır görsel: DiceBear (notionists, bottts, lorelei). Kaydettiğinizde
                bağlantı profilinize yazılır.
              </p>
            </div>
            <ScrollArea className="h-[min(42vh,420px)] pr-3">
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-7 md:grid-cols-8">
                {HYBRID_AVATAR_URLS.slice(0, hybridVisible).map((url, i) => {
                  const selected = selectedSystemUrl === url
                  return (
                    <button
                      key={`hybrid-${i}`}
                      type="button"
                      title={`#${i + 1}`}
                      onClick={() => setSelectedSystemUrl(url)}
                      className={cn(
                        "flex aspect-square items-center justify-center overflow-hidden rounded-xl border-2 bg-muted/30 p-1 transition-colors hover:bg-muted/60",
                        selected ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                      )}
                    >
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="size-full object-contain"
                      />
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
            {hybridVisible < HYBRID_AVATAR_COUNT ? (
              <Button
                type="button"
                variant="secondary"
                className="w-full shrink-0"
                onClick={() =>
                  setHybridVisible((v) => Math.min(HYBRID_AVATAR_COUNT, v + HYBRID_PAGE_SIZE))
                }
              >
                Daha fazla göster ({HYBRID_AVATAR_COUNT - hybridVisible} kaldı)
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" onClick={() => void saveAvatar(null)} disabled={saving}>
            Kaldır
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            İptal
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
