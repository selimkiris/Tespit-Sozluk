"use client"

import { useSearchParams } from "next/navigation"
import { ResetPasswordForm } from "@/components/reset-password-form"

export function SifreSifirlaInner() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  return <ResetPasswordForm token={token} />
}
