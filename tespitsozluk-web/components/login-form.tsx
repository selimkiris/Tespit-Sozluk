"use client"

import Link from "next/link"
import type { RefObject } from "react"
import { Eye, EyeOff } from "lucide-react"
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export interface LoginFormProps {
  email: string
  password: string
  showPassword: boolean
  rememberMe: boolean
  isLoading: boolean
  error: string
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onTogglePassword: () => void
  onRememberMeChange: (value: boolean) => void
  onSubmit: (e: React.FormEvent) => void
  turnstileRef: RefObject<TurnstileInstance | null>
  onTurnstileSuccess: (token: string) => void
  onTurnstileExpire: () => void
  onTurnstileError: () => void
}

export function LoginForm({
  email,
  password,
  showPassword,
  rememberMe,
  isLoading,
  error,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onRememberMeChange,
  onSubmit,
  turnstileRef,
  onTurnstileSuccess,
  onTurnstileExpire,
  onTurnstileError,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">İçeri Girin</h2>
      <div className="space-y-2">
        <Label htmlFor="login-email" className="text-sm text-foreground">
          E-Postanı yaz
        </Label>
        <Input
          id="login-email"
          type="email"
          placeholder="ornek@gmail.com"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          required
          className="h-10 bg-secondary/50 border-border focus:border-ring"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="login-password" className="text-sm text-foreground">
          Parolayı Söyle!
        </Label>
        <div className="relative">
          <Input
            id="login-password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            className="h-10 bg-secondary/50 border-border focus:border-ring pr-10"
          />
          <button
            type="button"
            onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-right">
          <Link
            href="/sifremi-unuttum"
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Parolayı unuttum
          </Link>
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="remember-me"
          checked={rememberMe}
          onCheckedChange={(checked) => onRememberMeChange(checked === true)}
        />
        <Label htmlFor="remember-me" className="text-sm text-muted-foreground cursor-pointer">
          Unutma beni
        </Label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Turnstile
        ref={turnstileRef}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
        onSuccess={onTurnstileSuccess}
        onExpire={onTurnstileExpire}
        onError={onTurnstileError}
      />

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
      >
        {isLoading ? "İçeri giriliyor..." : "İçeri Gir"}
      </Button>
    </form>
  )
}
