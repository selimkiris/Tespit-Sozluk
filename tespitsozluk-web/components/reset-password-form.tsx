"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function validatePasswordRules(p: string): string | null {
  if (p.length < 8) return "Şifre en az 8 karakter olmalıdır."
  if (!/[A-Z]/.test(p)) return "Şifre en az bir büyük harf içermelidir."
  if (!/[0-9]/.test(p)) return "Şifre en az bir rakam içermelidir."
  return null
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [passwordAgain, setPasswordAgain] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordAgain, setShowPasswordAgain] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const ruleErr = validatePasswordRules(password)
    if (ruleErr) {
      setError(ruleErr)
      return
    }
    if (password !== passwordAgain) {
      setError("Şifreler eşleşmiyor.")
      return
    }

    setIsLoading(true)
    try {
      const res = await apiFetch(getApiUrl("api/Auth/reset-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message?: unknown }).message)
            : "Şifre güncellenemedi."
        throw new Error(msg)
      }
      toast.success("Şifreniz güncellendi")
      router.replace("/login")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token.trim()) {
    return (
      <p className="text-sm text-destructive">
        Geçerli bir sıfırlama bağlantısı bulunamadı. Lütfen e-postanızdaki linki kullanın.
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="new-password" className="text-sm text-foreground">
          Yeni Şifre
        </Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
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

      <div className="space-y-2">
        <Label htmlFor="new-password-again" className="text-sm text-foreground">
          Yeni Şifre (Tekrar)
        </Label>
        <div className="relative">
          <Input
            id="new-password-again"
            type={showPasswordAgain ? "text" : "password"}
            autoComplete="new-password"
            value={passwordAgain}
            onChange={(e) => setPasswordAgain(e.target.value)}
            required
            className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPasswordAgain(!showPasswordAgain)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPasswordAgain ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
      >
        {isLoading ? "Kaydediliyor..." : "Şifreyi Güncelle"}
      </Button>
    </form>
  )
}
