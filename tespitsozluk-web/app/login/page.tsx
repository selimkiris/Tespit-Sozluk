"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAuth } from "@/lib/auth"

export default function LoginPage() {
  const router = useRouter()
  useEffect(() => {
    if (getAuth()) {
      router.replace("/")
    } else {
      router.replace("/?login=1")
    }
  }, [router])
  return null
}
