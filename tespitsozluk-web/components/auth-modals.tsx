"use client"

import { useState } from "react"
import { X, Eye, EyeOff } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export interface AuthResponse {
  token: string
  userId: string
  email: string
  firstName: string
  lastName: string
  username?: string
  avatar?: string | null
  hasChangedUsername?: boolean
  role?: string
}

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  onLogin: (auth: AuthResponse) => void
  onSwitchToRegister: () => void
}

export function LoginModal({ isOpen, onClose, onLogin, onSwitchToRegister }: LoginModalProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      const res = await fetch(getApiUrl("api/Auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data === "string" ? data : (data.message ?? data.title ?? "E-posta veya şifre hatalı.")
        throw new Error(msg)
      }
      // C# AuthResponseDto: token, userId, email, firstName, lastName, avatar, hasChangedUsername (camelCase)
      onLogin({
        token: data.token,
        userId: String(data.userId),
        email: data.email ?? "",
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        username: data.username ?? "",
        avatar: data.avatar ?? null,
        hasChangedUsername: data.hasChangedUsername ?? false,
        role: data.role ?? "User",
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş yapılamadı")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Giriş Yap</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email" className="text-sm text-foreground">
              E-posta
            </Label>
            <Input
              id="login-email"
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 bg-secondary/50 border-border focus:border-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password" className="text-sm text-foreground">
              Şifre
            </Label>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
              Beni hatırla
            </Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
          >
            {isLoading ? "Giriş yapılıyor..." : "Giriş Yap"}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Hesabınız yok mu?{" "}
            <button
              onClick={onSwitchToRegister}
              className="text-foreground hover:underline underline-offset-2"
            >
              Kayıt olun
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}

interface RegisterModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: (auth: AuthResponse) => void
  onSwitchToLogin: () => void
}

export function RegisterModal({
  isOpen,
  onClose,
  onRegister,
  onSwitchToLogin,
}: RegisterModalProps) {
  const [nickname, setNickname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (nickname.length < 3) {
      setError("Kullanıcı adı en az 3 karakter olmalıdır")
      return
    }

    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalıdır")
      return
    }

    setIsLoading(true)

    try {
      const registerRes = await fetch(getApiUrl("api/Auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName: nickname,
          lastName: "",
        }),
      })

      const registerData = await registerRes.json().catch(() => ({}))
      if (registerRes.status === 429) {
        const seconds = Math.ceil(registerData.retryAfterSeconds ?? 60)
        toast.warning(`Çok fazla kayıt denemesi. Lütfen ${seconds} saniye sonra tekrar deneyin.`, {
          duration: 6000,
          style: { background: "#78350f", color: "#fef3c7", border: "1px solid #d97706" },
        })
        return
      }
      if (!registerRes.ok) {
        throw new Error(registerData.message || registerData.title || "Kayıt yapılamadı")
      }

      const loginRes = await fetch(getApiUrl("api/Auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const loginData = await loginRes.json().catch(() => ({}))
      if (!loginRes.ok) {
        throw new Error("Kayıt başarılı ancak giriş yapılamadı. Lütfen giriş yapın.")
      }
      onRegister({
        token: loginData.token,
        userId: String(loginData.userId),
        email: loginData.email ?? "",
        firstName: loginData.firstName ?? "",
        lastName: loginData.lastName ?? "",
        username: loginData.username ?? "",
        avatar: loginData.avatar ?? null,
        hasChangedUsername: loginData.hasChangedUsername ?? false,
        role: loginData.role ?? "User",
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt yapılamadı")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Kayıt Ol</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            role="alert"
            className="rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 dark:border-amber-400/40 dark:bg-amber-950/40"
          >
            <p className="font-medium">
              ⚠️ Önemli: Şu anda &quot;Şifremi Unuttum&quot; altyapımız bulunmamaktadır. Lütfen şifrenizi güvenli bir yere kaydedin ve unutmayın!
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nickname" className="text-sm text-foreground">
              Kullanıcı Adı
            </Label>
            <Input
              id="nickname"
              type="text"
              placeholder="anonim_kullanici"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
              className="h-10 bg-secondary/50 border-border focus:border-ring"
            />
            <p className="text-xs text-muted-foreground">
              Bu isim herkese görünür olacak
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-email" className="text-sm text-foreground">
              E-posta
            </Label>
            <Input
              id="register-email"
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 bg-secondary/50 border-border focus:border-ring"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="register-password" className="text-sm text-foreground">
              Şifre
            </Label>
            <div className="relative">
              <Input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
          >
            {isLoading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
          </Button>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Zaten hesabınız var mı?{" "}
            <button
              onClick={onSwitchToLogin}
              className="text-foreground hover:underline underline-offset-2"
            >
              Giriş yapın
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
