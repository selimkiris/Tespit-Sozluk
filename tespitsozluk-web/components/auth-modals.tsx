"use client"

import { useRef, useState } from "react"
import { X } from "lucide-react"
import { getApiUrl, apiFetch } from "@/lib/api"
import type { AuthResponse } from "@/lib/auth-types"
import { LoginForm } from "@/components/login-form"
import { RegisterForm } from "@/components/register-form"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"

export type { AuthResponse } from "@/lib/auth-types"

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
  const [turnstileToken, setTurnstileToken] = useState("")
  const turnstileRef = useRef<TurnstileInstance>(null)

  const resetTurnstile = () => {
    setTurnstileToken("")
    turnstileRef.current?.reset()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!turnstileToken) {
      setError("Lütfen güvenlik doğrulamasını bekleyin.")
      return
    }

    setIsLoading(true)

    try {
      const res = await apiFetch(getApiUrl("api/Auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, turnstileToken }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        resetTurnstile()
        const msg = typeof data === "string" ? data : (data.message ?? data.title ?? "Ya hafızan zayıf ya da yazmayı bilmiyorsun (E-posta veya Parola yanlış)")
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
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <LoginForm
          email={email}
          password={password}
          showPassword={showPassword}
          rememberMe={rememberMe}
          isLoading={isLoading}
          error={error}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onRememberMeChange={setRememberMe}
          onSubmit={handleSubmit}
          turnstileRef={turnstileRef}
          onTurnstileSuccess={setTurnstileToken}
          onTurnstileExpire={() => setTurnstileToken("")}
          onTurnstileError={() => setTurnstileToken("")}
        />

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Hesabınız yok mu? O zaman burada ne işiniz var?{" "}
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
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-6 mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Kayıt Ol</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <RegisterForm onRegistered={onRegister} onClose={onClose} onSwitchToLogin={onSwitchToLogin} />
      </div>
    </div>
  )
}
