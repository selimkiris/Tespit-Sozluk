"use client"

import { useState, useEffect } from "react"
import { Settings, User, Lock, Eye, EyeOff, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import { validateNicknameTrimmed } from "@/lib/nickname.schema"
import { isReservedNickname } from "@/lib/reserved-usernames"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    name: string
    email: string
    avatar?: string | null
    hasChangedUsername?: boolean
  }
  onUserUpdate?: (updates: { avatar?: string; name?: string; nickname?: string }) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  user,
  onUserUpdate,
}: SettingsDialogProps) {
  const [username, setUsername] = useState("")
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  /** 0–3: backend MessagingInboxMode */
  const [inboxMode, setInboxMode] = useState(0)
  /** 0–10; yalnızca inboxMode === 3 için anlamlı */
  const [minLevelThreshold, setMinLevelThreshold] = useState(0)
  const [messagingLoading, setMessagingLoading] = useState(false)
  const [messagingSaving, setMessagingSaving] = useState(false)
  const [messagingError, setMessagingError] = useState<string | null>(null)

  const hasChangedUsername = user.hasChangedUsername ?? false
  const usernameTrimmed = username.trim()
  const usernameReservedBlocked =
    usernameTrimmed.length > 0 && isReservedNickname(usernameTrimmed)

  useEffect(() => {
    if (open) {
      setUsername("")
      setUsernameError(null)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordError(null)
      setMessagingError(null)

      let cancelled = false
      setMessagingLoading(true)
      ;(async () => {
        try {
          const res = await apiFetch(getApiUrl("api/Users/settings/messaging"))
          if (!res.ok || cancelled) return
          const data = (await res.json()) as {
            inboxMode?: number
            minLevelThreshold?: number | null
          }
          if (cancelled) return
          if (typeof data.inboxMode === "number") setInboxMode(data.inboxMode)
          if (data.minLevelThreshold != null) setMinLevelThreshold(data.minLevelThreshold)
        } catch {
          /* ayarlar sekmesinde sessiz; kullanıcı kaydetmeyi dener */
        } finally {
          if (!cancelled) setMessagingLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }
  }, [open])

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasChangedUsername) return
    const trimmed = username.trim()
    if (isReservedNickname(trimmed)) {
      setUsernameError("Bu isim kullanılamaz")
      return
    }
    const nickErr = validateNicknameTrimmed(trimmed)
    if (nickErr) {
      setUsernameError(nickErr)
      return
    }
    setUsernameSaving(true)
    setUsernameError(null)
    try {
      const res = await apiFetch(getApiUrl("api/Users/settings/username"), {
        method: "PUT",
        body: JSON.stringify({ newUsername: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message ?? "Mahlas güncellenemedi.")
      }
      onUserUpdate?.({ name: data.nickname ?? trimmed, nickname: data.nickname ?? trimmed })
      toast.success("Mahlasınız güncellendi.")
      setUsername("")
    } catch (err) {
      setUsernameError(err instanceof Error ? err.message : "Mahlas güncellenemedi.")
    } finally {
      setUsernameSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Tüm alanları doldurun.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Yeni parolalar eşleşmiyor.")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Yeni parola en az 8 karakter olmalıdır.")
      return
    }
    setPasswordSaving(true)
    try {
      const res = await apiFetch(getApiUrl("api/Users/settings/password"), {
        method: "PUT",
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message ?? "Parola güncellenemedi.")
      }
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success("Şifreniz güncellendi.")
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Parola güncellenemedi.")
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleMessagingSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessagingError(null)
    if (inboxMode === 3 && (minLevelThreshold < 0 || minLevelThreshold > 10)) {
      setMessagingError("Seviye 0 ile 10 arasında olmalıdır.")
      return
    }
    setMessagingSaving(true)
    try {
      const res = await apiFetch(getApiUrl("api/Users/settings/messaging"), {
        method: "PUT",
        body: JSON.stringify({
          inboxMode,
          minLevelThreshold: inboxMode === 3 ? minLevelThreshold : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.message ?? "Tercihler kaydedilemedi.")
      }
      if (typeof data.inboxMode === "number") setInboxMode(data.inboxMode)
      if (data.minLevelThreshold != null) setMinLevelThreshold(data.minLevelThreshold)
      else if (inboxMode !== 3) setMinLevelThreshold(0)
      toast.success("Mesajlaşma tercihleriniz güncellendi.")
    } catch (err) {
      setMessagingError(
        err instanceof Error ? err.message : "Tercihler kaydedilemedi."
      )
    } finally {
      setMessagingSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ayarlar
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto sm:h-9 gap-0.5 p-1">
            <TabsTrigger value="account" className="gap-1 text-[11px] sm:text-sm px-1 sm:px-2">
              <User className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Hesap</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1 text-[11px] sm:text-sm px-1 sm:px-2">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Güvenlik</span>
            </TabsTrigger>
            <TabsTrigger value="messaging" className="gap-1 text-[11px] sm:text-sm px-1 sm:px-2">
              <MessageCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Mesaj</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Mahlasınızı değiştirin
            </p>
            {hasChangedUsername ? (
              <div className="space-y-2">
                <Input
                  id="new-username"
                  value={user.name}
                  disabled
                  className="h-10 bg-muted cursor-not-allowed"
                />
                <p className="text-sm font-medium text-destructive">
                  Zaten 1 defa değiştirdiniz, başka hakkınız yok
                </p>
              </div>
            ) : (
              <form onSubmit={handleUsernameSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-username">Yeni Mahlas</Label>
                  <Input
                    id="new-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                    maxLength={20}
                    className="h-10"
                    disabled={usernameSaving}
                  />
                  <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                    Mahlasını sadece 1 defa değiştirebilirsin. İyi düşünün :)
                  </p>
                </div>
                {(usernameReservedBlocked || usernameError) && (
                  <p className="text-sm text-destructive" role="alert">
                    {usernameReservedBlocked
                      ? "Bu isim kullanılamaz"
                      : usernameError}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={
                    !username.trim() ||
                    usernameSaving ||
                    usernameReservedBlocked
                  }
                  className="w-full sm:w-auto"
                >
                  {usernameSaving ? "Kaydediliyor..." : "Mahlası Güncelle"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Parolanızı değiştirin
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Mevcut Parolanız</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 pr-10"
                    disabled={passwordSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Yeni Parolanız</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 pr-10"
                    disabled={passwordSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Yeni Parolanız (Bir daha yazın)</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-10 pr-10"
                    disabled={passwordSaving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <Button
                type="submit"
                disabled={passwordSaving}
                className="w-full sm:w-auto"
              >
                {passwordSaving ? "Güncelleniyor..." : "Parolayı Değiştir"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="messaging" className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium">Mesajlaşma tercihleri</h3>
            </div>

            {messagingLoading ? (
              <p className="text-sm text-muted-foreground">Yükleniyor…</p>
            ) : (
              <form onSubmit={handleMessagingSave} className="space-y-4">
                <RadioGroup
                  className="gap-3"
                  value={String(inboxMode)}
                  onValueChange={(v) => setInboxMode(Number(v))}
                >
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
                    <RadioGroupItem value="0" id="m-inbox-0" className="mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <Label htmlFor="m-inbox-0" className="text-sm font-medium cursor-pointer">
                        Herkesten mesaj al
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Tüm üyeler size mesaj gönderebilir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
                    <RadioGroupItem value="1" id="m-inbox-1" className="mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <Label htmlFor="m-inbox-1" className="text-sm font-medium cursor-pointer">
                        Çömezler hariç herkesten mesaj al
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        &quot;Çömez&quot; statüsündeki yazarlar gönderemez.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
                    <RadioGroupItem value="2" id="m-inbox-2" className="mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <Label htmlFor="m-inbox-2" className="text-sm font-medium cursor-pointer">
                        Yalnızca takip ettiklerimden mesaj al
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Sizin takip ettiğiniz kişiler size yazabilir.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/80 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/40">
                    <RadioGroupItem value="3" id="m-inbox-3" className="mt-0.5" />
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <Label htmlFor="m-inbox-3" className="text-sm font-medium cursor-pointer">
                        Yalnızca belirli Level ve üstü
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Profil seviyesi (Level 0–10) eşiğin altındakiler
                        gönderemez. Çömezler her zaman dışarıda kalır.
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {inboxMode === 3 && (
                  <div className="space-y-2 pl-1">
                    <Label htmlFor="min-level">En az Level</Label>
                    <Select
                      value={String(minLevelThreshold)}
                      onValueChange={(v) => setMinLevelThreshold(Number(v))}
                    >
                      <SelectTrigger id="min-level" className="w-full sm:w-64">
                        <SelectValue placeholder="Seviye seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 11 }, (_, i) => (
                          <SelectItem key={i} value={String(i)}>
                            Level {i}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {messagingError && (
                  <p className="text-sm text-destructive" role="alert">
                    {messagingError}
                  </p>
                )}
                <Button type="submit" disabled={messagingSaving}>
                  {messagingSaving ? "Kaydediliyor…" : "Tercihleri kaydet"}
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
