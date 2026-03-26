"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { EntryDetail } from "@/components/entry-detail"
import { Navbar } from "@/components/navbar"
import { getAuth, clearAuth } from "@/lib/auth"

type ApiEntry = {
  id: string
  topicId: string
  topicTitle: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  updatedAt?: string | null
  upvotes: number
  downvotes: number
  userVoteType?: number
  validBkzs?: Record<string, string> | null
  isAnonymous?: boolean
  canManage?: boolean
  saveCount?: number
  isSavedByCurrentUser?: boolean
}

interface EntryPageContentProps {
  entry: ApiEntry
}

export function EntryPageContent({ entry }: EntryPageContentProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [auth, setAuth] = useState<{ token: string; user: { id: string; nickname?: string; email?: string } } | null>(null)

  useEffect(() => {
    setAuth(getAuth())
  }, [])

  // Client navigasyonda (/entry/1 → /entry/2) RSC payload bazen eski entry ile kalabiliyor; URL segment'i ile eşleşmezse sunucu ağacını yenile.
  useEffect(() => {
    const segment = pathname?.match(/^\/entry\/([^/]+)/)?.[1]
    if (!segment || segment === String(entry.id)) return
    router.refresh()
  }, [pathname, entry.id, router])

  const isLoggedIn = !!auth?.token
  const currentUser = auth?.user ? { id: auth.user.id } : null

  const handleTopicClick = useCallback(
    (topicId: string) => {
      router.push(`/?topic=${topicId}`)
    },
    [router]
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        isLoggedIn={isLoggedIn}
        user={
          auth?.user
            ? {
                name: auth.user.nickname ?? auth.user.email ?? "Kullanıcı",
                email: auth.user.email ?? "",
              }
            : undefined
        }
        onLoginClick={() => router.push("/?login=1")}
        onRegisterClick={() => router.push("/?register=1")}
        onLogout={() => {
          clearAuth()
          window.location.href = "/"
        }}
        onProfileClick={() => auth?.user?.id && router.push(`/user/${auth.user.id}`)}
        onMenuClick={() => {}}
        isMobileMenuOpen={false}
        onHomeClick={() => router.push("/")}
        onAllTopicsClick={() => router.push("/?topics=1")}
        onTopicSelect={(topicId) => router.push(`/?topic=${topicId}`)}
        onUserSelect={(userId) => router.push(`/user/${userId}`)}
      />
      <main className="w-full pt-[6.5rem] md:pt-14 lg:flex lg:justify-start lg:pl-[312px] xl:pl-[344px]">
        <div className="w-full max-w-2xl mx-auto px-4 py-6 lg:mx-0 lg:max-w-[786px] lg:px-6 lg:py-8">
          <EntryDetail
            entry={entry}
            isLoggedIn={isLoggedIn}
            currentUser={currentUser}
            onLoginClick={() => router.push("/?login=1")}
            onTopicClick={handleTopicClick}
          />
        </div>
      </main>
    </div>
  )
}
