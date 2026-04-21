"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import {
  registerFormSchema,
  type RegisterFormValues,
  REGISTER_EMAIL_TAKEN_MESSAGE,
  REGISTER_NICK_TAKEN_MESSAGE,
  REGISTER_RESERVED_USERNAME_MESSAGE,
} from "@/lib/auth.schema"
import { isReservedNickname } from "@/lib/reserved-usernames"
import type { AuthResponse } from "@/lib/auth-types"
import { RegisterLegalModals } from "@/components/register-legal-documents"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function extractApiMessage(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim()
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message
    if (typeof m === "string" && m.trim()) return m.trim()
  }
  if (data && typeof data === "object" && "title" in data) {
    const t = (data as { title?: unknown }).title
    if (typeof t === "string" && t.trim()) return t.trim()
  }
  return ""
}

interface RegisterFormProps {
  onRegistered: (auth: AuthResponse) => void
  onClose: () => void
  onSwitchToLogin: () => void
}

export function RegisterForm({ onRegistered: _onRegistered, onClose: _onClose, onSwitchToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null)
  const [policiesAccepted, setPoliciesAccepted] = useState(false)
  const turnstileTokenRef = useRef("")
  const turnstileRef = useRef<TurnstileInstance>(null)

  const setTurnstileToken = (token: string) => {
    turnstileTokenRef.current = token
  }

  const resetTurnstile = () => {
    turnstileTokenRef.current = ""
    turnstileRef.current?.reset()
  }

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const nicknameWatch = watch("nickname")
  const nicknameTrimmed = nicknameWatch?.trim() ?? ""
  const isReservedNick =
    nicknameTrimmed.length > 0 && isReservedNickname(nicknameTrimmed)
  const nicknameFeedback =
    errors.nickname?.message ??
    (isReservedNick ? "Bu isim kullanılamaz" : "")

  const onSubmit = async (values: RegisterFormValues) => {
    clearErrors("root")
    if (!policiesAccepted) {
      toast.error("Lütfen sözleşmeleri onaylayın")
      return
    }
    const turnstileToken = turnstileTokenRef.current
    if (!turnstileToken) {
      setError("root", { message: "Lütfen güvenlik doğrulamasını bekleyin." })
      return
    }

    setIsLoading(true)
    try {
      const registerRes = await apiFetch(getApiUrl("api/Auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email.trim(),
          password: values.password,
          username: values.nickname.trim(),
          firstName: values.nickname.trim(),
          lastName: "",
          turnstileToken,
        }),
      })

      let registerData: unknown = {}
      try {
        registerData = await registerRes.json()
      } catch {
        registerData = {}
      }

      if (registerRes.status === 429) {
        resetTurnstile()
        const apiMsg = extractApiMessage(registerData)
        const retry = (registerData as { retryAfterSeconds?: number }).retryAfterSeconds
        const seconds = Math.ceil(retry ?? 60)
        toast.warning(
          apiMsg || `Çok fazla kayıt denemesi. Lütfen ${seconds} saniye sonra tekrar deneyin.`,
          {
            duration: 8000,
            style: { background: "#78350f", color: "#fef3c7", border: "1px solid #d97706" },
          },
        )
        return
      }

      if (!registerRes.ok) {
        resetTurnstile()
        const msg = extractApiMessage(registerData) || "Kayıt yapılamadı"

        if (msg === REGISTER_NICK_TAKEN_MESSAGE) {
          setError("nickname", { type: "server", message: msg })
        } else if (msg === REGISTER_RESERVED_USERNAME_MESSAGE) {
          setError("nickname", { type: "server", message: msg })
        } else if (msg === REGISTER_EMAIL_TAKEN_MESSAGE) {
          setError("email", { type: "server", message: msg })
        } else {
          setError("root", { type: "server", message: msg })
        }
        return
      }

      setIsSuccess(true)
    } catch {
      setError("root", { message: "Kayıt yapılamadı" })
      resetTurnstile()
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div
        className="rounded-lg border border-green-500/20 bg-green-500/10 p-4 text-green-500"
        role="status"
      >
        <p className="text-sm leading-relaxed">
          Tebrikler, kayıt işleminiz mükemmel oldu. Şimdi{" "}
          <Link href="/login" className="font-bold underline underline-offset-2">
            İçeri girin
          </Link>
        </p>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {errors.root?.message && (
          <p className="text-sm text-destructive" role="alert">
            {errors.root.message}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="nickname" className="text-sm text-foreground">
            Mahlas
          </Label>
          <Input
            id="nickname"
            type="text"
            placeholder="kendine bir mahlas bul"
            autoComplete="username"
            maxLength={20}
            className="h-10 bg-secondary/50 border-border focus:border-ring"
            {...register("nickname")}
          />
          <p className="text-xs text-muted-foreground">Bu isim herkese görünür olacak</p>
          {nicknameFeedback ? (
            <p className="text-sm text-destructive" role="alert">
              {nicknameFeedback}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email" className="text-sm text-foreground">
            E-posta
          </Label>
          <Input
            id="register-email"
            type="email"
            placeholder="ornek@gmail.com"
            autoComplete="email"
            className="h-10 bg-secondary/50 border-border focus:border-ring"
            {...register("email")}
          />
          <p className="text-xs text-muted-foreground">
            E-posta doğrulaması gerekebilir, lütfen geçerli bir e-posta adresi giriniz. E-posta adresinizi diğer kullanıcılar göremez 🔒
          </p>
          {errors.email?.message && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
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
              autoComplete="new-password"
              className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            En az 8 karakter, büyük harf ve rakam içermelidir
          </p>
          {errors.password?.message && (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password-confirm" className="text-sm text-foreground">
            Şifre Tekrar
          </Label>
          <div className="relative">
            <Input
              id="register-password-confirm"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
              {...register("confirmPassword")}
              onPaste={(e) => e.preventDefault()}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword?.message && (
            <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>

        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
          onSuccess={(token) => setTurnstileToken(token)}
          onExpire={() => setTurnstileToken("")}
          onError={() => setTurnstileToken("")}
        />

        <div className="flex items-start gap-3 rounded-md border border-border/60 bg-secondary/20 p-3">
          <Checkbox
            id="register-policies-accept"
            checked={policiesAccepted}
            onCheckedChange={(v) => setPoliciesAccepted(v === true)}
            className="mt-0.5"
            aria-describedby="register-policies-label"
          />
          <p id="register-policies-label" className="min-w-0 text-sm leading-relaxed text-muted-foreground">
            Kayıt olarak{" "}
            <button
              type="button"
              onClick={() => setLegalModal("privacy")}
              className="text-primary hover:underline cursor-pointer font-medium"
            >
              Gizlilik Politikası
            </button>{" "}
            ve{" "}
            <button
              type="button"
              onClick={() => setLegalModal("terms")}
              className="text-primary hover:underline cursor-pointer font-medium"
            >
              Kullanım Koşulları
            </button>
            &apos;nı okuduğumu ve kabul ettiğimi onaylıyorum.
          </p>
        </div>

        <Button
          type="submit"
          disabled={isLoading || isReservedNick}
          className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
        >
          {isLoading ? "Kayıt yapılıyor..." : "Kayıt Ol"}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Zaten hesabınız var mı? O zaman burada ne işiniz var?{" "}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-foreground hover:underline underline-offset-2"
          >
            İçeri girin
          </button>
        </p>
      </div>

      <RegisterLegalModals open={legalModal} onOpenChange={setLegalModal} />
    </>
  )
}
