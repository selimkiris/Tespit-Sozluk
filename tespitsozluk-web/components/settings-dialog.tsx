"use client"

import { useState, useEffect } from "react"
import { Settings, User, Lock, Eye, EyeOff } from "lucide-react"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Ayarlar
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account" className="gap-1.5 text-xs sm:text-sm">
              <User className="h-3.5 w-3.5" />
              Hesap
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs sm:text-sm">
              <Lock className="h-3.5 w-3.5" />
              Güvenlik
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
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
