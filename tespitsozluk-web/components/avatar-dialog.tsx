"use client"

import { useState, useEffect } from "react"
import { Camera, Link2, Check } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// DiceBear 8 distinct stil - 200 adet avatar (8 stil x 25 seed)
const AVATAR_STYLES = [
  { name: "avataaars", options: "backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf" },
  { name: "bottts-neutral", options: "backgroundColor=b6e3f4,c0aede" },
  { name: "big-smile", options: "backgroundColor=ffd5dc" },
  { name: "pixel-art", options: "backgroundColor=d1d4f9" },
  { name: "shapes", options: "backgroundColor=ffdfbf" },
  { name: "notionists", options: "backgroundColor=ffdfbf,c0aede" },
  { name: "croodles", options: "backgroundColor=b6e3f4" },
  { name: "thumbs", options: "backgroundColor=ffd5dc" },
]
const AVATAR_OPTIONS = AVATAR_STYLES.flatMap((style) =>
  Array.from({ length: 25 }).map((_, i) =>
    `https://api.dicebear.com/7.x/${style.name}/svg?seed=Karargah${style.name}${i}&${style.options}`
  )
)

interface AvatarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentAvatar?: string | null
  onAvatarUpdate?: (avatar: string) => void
  currentUserRole?: string
}

export function AvatarDialog({
  open,
  onOpenChange,
  currentAvatar,
  onAvatarUpdate,
  currentUserRole,
}: AvatarDialogProps) {
  const [avatarSaving, setAvatarSaving] = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(currentAvatar ?? null)
  const [customUrlInput, setCustomUrlInput] = useState("")
  const [customUrlSaving, setCustomUrlSaving] = useState(false)

  const isAdmin = currentUserRole === "Admin"

  useEffect(() => {
    if (open) {
      setSelectedAvatar(currentAvatar ?? null)
      setCustomUrlInput("")
    }
  }, [open, currentAvatar])

  const saveAvatar = async (avatarUrl: string, setLoading: (v: boolean) => void) => {
    setLoading(true)
    try {
      const res = await fetch(getApiUrl("api/Users/settings/avatar"), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ avatar: avatarUrl }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.message ?? "Avatar güncellenemedi.")
      setSelectedAvatar(avatarUrl)
      onAvatarUpdate?.(avatarUrl)
      toast.success("Avatar güncellendi.")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Avatar güncellenemedi.")
    } finally {
      setLoading(false)
    }
  }

  const handleAvatarSelect = (avatarUrl: string) => saveAvatar(avatarUrl, setAvatarSaving)

  const handleCustomUrlSave = () => {
    const trimmed = customUrlInput.trim()
    if (!trimmed) { toast.error("URL boş olamaz."); return }
    if (!trimmed.startsWith("http")) { toast.error("Geçerli bir URL girin (http ile başlamalı)."); return }
    saveAvatar(trimmed, setCustomUrlSaving)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Avatar Seç
          </DialogTitle>
        </DialogHeader>

        {/* Admin: Özel URL bölümü */}
        {isAdmin && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive/20">
                <Link2 className="h-3 w-3 text-destructive" />
              </div>
              <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                Admin Özel Avatar URL
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="https://i.ibb.co/... veya herhangi bir resim URL'si"
                className="h-9 text-sm flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrlSave() }}
              />
              <Button
                size="sm"
                onClick={handleCustomUrlSave}
                disabled={customUrlSaving || !customUrlInput.trim()}
                className="h-9 gap-1.5 shrink-0"
              >
                {customUrlSaving ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Kaydet
              </Button>
            </div>
            {customUrlInput.trim() && customUrlInput.startsWith("http") && (
              <div className="mt-2.5 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Önizleme:</span>
                <img
                  src={customUrlInput.trim()}
                  alt="önizleme"
                  className="h-8 w-8 rounded-full object-cover border border-border/60"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                />
              </div>
            )}
          </div>
        )}

        <p className="text-sm text-muted-foreground mb-4">
          Hazır avatarlardan birini seçin
        </p>
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[350px] overflow-y-auto pr-1">
          {AVATAR_OPTIONS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => handleAvatarSelect(url)}
              disabled={avatarSaving || customUrlSaving}
              className={cn(
                "flex items-center justify-center h-12 w-12 rounded-full border-2 overflow-hidden transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed hover:ring-2 hover:ring-ring cursor-pointer",
                selectedAvatar === url
                  ? "border-foreground ring-2 ring-ring shadow-md"
                  : "border-border bg-muted/40 hover:border-muted-foreground/50"
              )}
            >
              <img src={url} alt="avatar" className="w-12 h-12 object-cover rounded-full bg-gray-100" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
