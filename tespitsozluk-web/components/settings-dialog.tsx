"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Settings, User, Lock, Eye, EyeOff, MessageCircle, Ban, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import { clearAuth } from "@/lib/auth"
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  /** 1: uyarı, 2: mahlas doğrulama */
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1)
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false)
  /** Hesap silme modalında mahlas doğrulaması */
  const [confirmDeleteNickname, setConfirmDeleteNickname] = useState("")

  /** Engellenenler sekmesi state'i */
  type BlockedUserItem = { id: string; username: string; avatar?: string | null; blockedAtUtc: string }
  type BlockedTopicItem = { id: string; title: string; slug: string; blockedAtUtc: string }
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([])
  const [blockedTopics, setBlockedTopics] = useState<BlockedTopicItem[]>([])
  const [blockedLoading, setBlockedLoading] = useState(false)
  const [blockedLoaded, setBlockedLoaded] = useState(false)
  const [unblockUserTarget, setUnblockUserTarget] = useState<BlockedUserItem | null>(null)
  const [unblockTopicTarget, setUnblockTopicTarget] = useState<BlockedTopicItem | null>(null)
  const [unblockSubmitting, setUnblockSubmitting] = useState(false)

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
      setConfirmDeleteOpen(false)
      setDeleteStep(1)
      setConfirmDeleteNickname("")
      setBlockedLoaded(false)
      setBlockedUsers([])
      setBlockedTopics([])

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

  const fetchBlockedLists = useCallback(async () => {
    setBlockedLoading(true)
    try {
      const [usersRes, topicsRes] = await Promise.all([
        apiFetch(getApiUrl("api/blocks/users")),
        apiFetch(getApiUrl("api/blocks/topics")),
      ])
      if (usersRes.ok) {
        const data = await usersRes.json()
        const items: BlockedUserItem[] = Array.isArray(data)
          ? data.map((d: { id: string; username?: string; avatar?: string | null; blockedAtUtc?: string }) => ({
              id: String(d.id),
              username: d.username ?? "Anonim",
              avatar: d.avatar ?? null,
              blockedAtUtc: d.blockedAtUtc ?? "",
            }))
          : []
        setBlockedUsers(items)
      } else {
        setBlockedUsers([])
      }
      if (topicsRes.ok) {
        const data = await topicsRes.json()
        const items: BlockedTopicItem[] = Array.isArray(data)
          ? data.map((d: { id: string; title?: string; slug?: string; blockedAtUtc?: string }) => ({
              id: String(d.id),
              title: d.title ?? "(başlıksız)",
              slug: d.slug ?? "",
              blockedAtUtc: d.blockedAtUtc ?? "",
            }))
          : []
        setBlockedTopics(items)
      } else {
        setBlockedTopics([])
      }
      setBlockedLoaded(true)
    } catch {
      setBlockedUsers([])
      setBlockedTopics([])
      setBlockedLoaded(true)
    } finally {
      setBlockedLoading(false)
    }
  }, [])

  const handleConfirmUnblockUser = useCallback(async () => {
    if (!unblockUserTarget || unblockSubmitting) return
    setUnblockSubmitting(true)
    const target = unblockUserTarget
    // Optimistic UI: önce listeden çıkar; başarısız olursa geri ekle.
    setBlockedUsers((prev) => prev.filter((u) => u.id !== target.id))
    try {
      const res = await apiFetch(getApiUrl(`api/blocks/users/${target.id}`), {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(typeof data === "string" ? data : (data?.message ?? "Engel kaldırılamadı."))
        setBlockedUsers((prev) => [target, ...prev])
        return
      }
      toast.success(`${target.username} üzerindeki engel kaldırıldı.`)
      setUnblockUserTarget(null)
    } catch {
      toast.error("Engel kaldırılamadı.")
      setBlockedUsers((prev) => [target, ...prev])
    } finally {
      setUnblockSubmitting(false)
    }
  }, [unblockUserTarget, unblockSubmitting])

  const handleConfirmUnblockTopic = useCallback(async () => {
    if (!unblockTopicTarget || unblockSubmitting) return
    setUnblockSubmitting(true)
    const target = unblockTopicTarget
    setBlockedTopics((prev) => prev.filter((t) => t.id !== target.id))
    try {
      const res = await apiFetch(getApiUrl(`api/blocks/topics/${target.id}`), {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(typeof data === "string" ? data : (data?.message ?? "Engel kaldırılamadı."))
        setBlockedTopics((prev) => [target, ...prev])
        return
      }
      toast.success(`"${target.title}" başlığındaki engel kaldırıldı.`)
      setUnblockTopicTarget(null)
    } catch {
      toast.error("Engel kaldırılamadı.")
      setBlockedTopics((prev) => [target, ...prev])
    } finally {
      setUnblockSubmitting(false)
    }
  }, [unblockTopicTarget, unblockSubmitting])

  const formatBlockedAt = (iso: string) => {
    if (!iso) return ""
    try {
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ""
      return d.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    } catch {
      return ""
    }
  }

  const expectedMahlasForDelete = user.name.trim()
  const deleteNicknameMatchesConfirmation =
    confirmDeleteNickname.trim() === expectedMahlasForDelete &&
    expectedMahlasForDelete.length > 0

  const handleConfirmDeleteAccount = async () => {
    if (!deleteNicknameMatchesConfirmation) return
    setDeleteAccountLoading(true)
    try {
      const res = await apiFetch(getApiUrl("api/Users/me"), {
        method: "DELETE",
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : "Hesabınız silinemedi."
        )
      }
      toast.success("Hesabınız başarıyla silindi.")
      setConfirmDeleteOpen(false)
      setDeleteStep(1)
      setConfirmDeleteNickname("")
      onOpenChange(false)
      clearAuth()
      window.location.href = "/"
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Hesabınız silinemedi."
      )
    } finally {
      setDeleteAccountLoading(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ayarlar
          </DialogTitle>
        </DialogHeader>

        <Tabs
          defaultValue="account"
          className="w-full"
          onValueChange={(value) => {
            if (value === "blocked" && !blockedLoaded && !blockedLoading) {
              void fetchBlockedLists()
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-4 h-auto sm:h-9 gap-0.5 p-1">
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
            <TabsTrigger value="blocked" className="gap-1 text-[11px] sm:text-sm px-1 sm:px-2">
              <Ban className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Engellenenler</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="mt-4">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  Mahlas Değiştirme
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Mahlasınızı değiştirin
                </p>
              </div>

              {hasChangedUsername ? (
                <div className="space-y-2 pt-1">
                  <Label htmlFor="new-username-display">Mahlas</Label>
                  <Input
                    id="new-username-display"
                    value={user.name}
                    disabled
                    className="h-10 bg-muted cursor-not-allowed"
                  />
                  <p className="text-sm font-medium text-destructive">
                    Zaten 1 defa değiştirdiniz, başka hakkınız yok
                  </p>
                </div>
              ) : (
                <form onSubmit={handleUsernameSubmit} className="space-y-3 pt-1">
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
                    <p className="text-xs font-light leading-relaxed text-red-500/90 dark:text-red-400/90">
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
            </div>

            <div className="mt-14 space-y-3 border-t border-border/60 pt-12">
              <h3 className="text-lg font-semibold tracking-tight">
                Hesap Silme
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Hesabınız kalıcı olarak tüm verileriyle silinir.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => {
                  setDeleteStep(1)
                  setConfirmDeleteNickname("")
                  setConfirmDeleteOpen(true)
                }}
              >
                Hesabımı Sil
              </Button>
            </div>
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

          <TabsContent value="blocked" className="mt-4 space-y-6">
            {blockedLoading && !blockedLoaded ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Yükleniyor…</p>
            ) : (
              <>
                {/* Engellenen Kullanıcılar */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      Engellenen Kullanıcılar
                      <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums bg-muted text-muted-foreground">
                        {blockedUsers.length}
                      </span>
                    </h3>
                  </div>
                  {blockedUsers.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Engellediğiniz bir kullanıcı yok.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                      {blockedUsers.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
                        >
                          <Link
                            href={`/user/${u.id}`}
                            className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border/60 bg-muted text-muted-foreground hover:opacity-90 transition-opacity"
                            onClick={() => onOpenChange(false)}
                            aria-label={`${u.username} profiline git`}
                          >
                            {u.avatar &&
                            (u.avatar.startsWith("http") || u.avatar.startsWith("data:image")) ? (
                              <img
                                src={u.avatar}
                                alt=""
                                referrerPolicy="no-referrer"
                                className="h-9 w-9 object-cover"
                              />
                            ) : u.avatar ? (
                              <span className="text-base">{u.avatar}</span>
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                          </Link>
                          <div className="flex-1 min-w-0">
                            <Link
                              href={`/user/${u.id}`}
                              onClick={() => onOpenChange(false)}
                              className="text-sm font-medium text-foreground truncate block hover:underline underline-offset-2"
                            >
                              {u.username}
                            </Link>
                            {u.blockedAtUtc && (
                              <p className="text-[11px] text-muted-foreground">
                                Engellendi: {formatBlockedAt(u.blockedAtUtc)}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 shrink-0"
                            onClick={() => setUnblockUserTarget(u)}
                            disabled={unblockSubmitting}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Engeli Kaldır
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Engellenen başlıklar */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold tracking-tight flex items-center gap-2">
                      <Ban className="h-4 w-4 text-muted-foreground" />
                      Engellenen Başlıklar
                      <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums bg-muted text-muted-foreground">
                        {blockedTopics.length}
                      </span>
                    </h3>
                  </div>
                  {blockedTopics.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        Engellediğiniz bir başlık yok.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card/40">
                      {blockedTopics.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted text-muted-foreground">
                            <Ban className="h-4 w-4" />
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate block">
                              {t.title}
                            </span>
                            {t.blockedAtUtc && (
                              <p className="text-[11px] text-muted-foreground">
                                Engellendi: {formatBlockedAt(t.blockedAtUtc)}
                              </p>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="gap-1.5 shrink-0"
                            onClick={() => setUnblockTopicTarget(t)}
                            disabled={unblockSubmitting}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Engeli Kaldır
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    <AlertDialog
      open={confirmDeleteOpen}
      onOpenChange={(next) => {
        setConfirmDeleteOpen(next)
        if (!next) {
          setDeleteStep(1)
          setConfirmDeleteNickname("")
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        {deleteStep === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Hesabınızı silmek istediğinize emin misiniz?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-muted-foreground">
                Bu işlem geri alınamaz. Profiliniz, entryleriniz ve tüm etkileşimleriniz
                platformdan anında ve kalıcı olarak kaldırılacaktır.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel
                disabled={deleteAccountLoading}
                className="mt-0"
              >
                Vazgeç
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={deleteAccountLoading}
                onClick={() => setDeleteStep(2)}
              >
                Hesabımı Sil
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">
                İşlemi onaylamak için kullanıcı adınızı (mahlasınızı) yazın.
              </AlertDialogTitle>
              <AlertDialogDescription className="sr-only">
                Mahlasınızı aşağıdaki alana girin ve Hesabımı Sil ile doğrulayın.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid gap-2 py-1">
              <Label htmlFor="confirm-delete-nickname">
                Mahlas
              </Label>
              <Input
                id="confirm-delete-nickname"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={confirmDeleteNickname}
                onChange={(e) =>
                  setConfirmDeleteNickname(e.target.value.slice(0, 20))
                }
                maxLength={20}
                className="h-10"
                disabled={deleteAccountLoading}
              />
            </div>
            <AlertDialogFooter className="gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={deleteAccountLoading}
                onClick={() => {
                  setDeleteStep(1)
                  setConfirmDeleteNickname("")
                }}
              >
                Geri
              </Button>
              <AlertDialogCancel
                disabled={deleteAccountLoading}
                className="mt-0"
              >
                Vazgeç
              </AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                disabled={
                  deleteAccountLoading || !deleteNicknameMatchesConfirmation
                }
                onClick={() => void handleConfirmDeleteAccount()}
              >
                {deleteAccountLoading ? "Siliniyor…" : "Hesabımı Sil"}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={!!unblockUserTarget}
      onOpenChange={(next) => {
        if (!next && !unblockSubmitting) setUnblockUserTarget(null)
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RotateCcw className="h-4 w-4" />
            </span>
            Engeli Kaldır
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">
              {unblockUserTarget?.username}
            </span>{" "}
            kullanıcısı üzerindeki engeli kaldırmak istiyor musunuz? Profili
            ve entryleri yeniden size görünür olacak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unblockSubmitting}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirmUnblockUser()
            }}
            disabled={unblockSubmitting}
          >
            {unblockSubmitting ? "Kaldırılıyor…" : "Engeli Kaldır"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AlertDialog
      open={!!unblockTopicTarget}
      onOpenChange={(next) => {
        if (!next && !unblockSubmitting) setUnblockTopicTarget(null)
      }}
    >
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <RotateCcw className="h-4 w-4" />
            </span>
            Engeli Kaldır
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-semibold text-foreground">
              &quot;{unblockTopicTarget?.title}&quot;
            </span>{" "}
            başlığı üzerindeki engeli kaldırmak istiyor musunuz? Başlık tüm
            feed&apos;lerde tekrar size görünür olacak.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unblockSubmitting}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              void handleConfirmUnblockTopic()
            }}
            disabled={unblockSubmitting}
          >
            {unblockSubmitting ? "Kaldırılıyor…" : "Engeli Kaldır"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}
