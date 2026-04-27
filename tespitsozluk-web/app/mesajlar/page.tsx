"use client"

import { useState, useEffect, useLayoutEffect, useRef, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { TopicSidebar } from "@/components/topic-sidebar"
import { MessagesInboxView } from "@/components/messages-inbox-view"
import { getAuth, clearAuth, updateAuthUser, type AuthData } from "@/lib/auth"

export default function MesajlarPage() {
  const router = useRouter()
  const [auth, setAuth] = useState<AuthData | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [checked, setChecked] = useState(false)
  const redirecting = useRef(false)

  useLayoutEffect(() => {
    const a = getAuth()
    if (!a?.token) {
      if (!redirecting.current) {
        redirecting.current = true
        router.replace("/?login=1")
      }
      return
    }
    setAuth(a)
    setChecked(true)
  }, [router])

  if (!checked || !auth) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <p className="text-muted-foreground">Yükleniyor…</p>
      </div>
    )
  }

  const isLoggedIn = true

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <Navbar
        isLoggedIn={isLoggedIn}
        user={{
          name: auth.user.nickname ?? auth.user.name,
          email: auth.user.email,
          avatar: auth.user.avatar,
          hasChangedUsername: auth.user.hasChangedUsername,
          role: auth.user.role,
        }}
        onLoginClick={() => router.push("/?login=1")}
        onRegisterClick={() => router.push("/?register=1")}
        onLogout={() => {
          clearAuth()
          window.location.href = "/"
        }}
        onProfileClick={() => auth.user.id && router.push(`/user/${auth.user.id}`)}
        onMenuClick={() => setIsMobileMenuOpen((o) => !o)}
        isMobileMenuOpen={isMobileMenuOpen}
        onHomeClick={() => router.push("/")}
        onAllTopicsClick={() => {
          setIsMobileMenuOpen(false)
          router.push("/?topics=1")
        }}
        onTopicSelect={(topicId) => {
          router.push(`/?topic=${topicId}`)
          setIsMobileMenuOpen(false)
        }}
        onUserSelect={(userId) => {
          router.push(`/user/${userId}`)
          setIsMobileMenuOpen(false)
        }}
        onUserUpdate={(updates) => {
          const u = updateAuthUser(updates)
          if (u) setAuth(getAuth())
        }}
      />

      <TopicSidebar
        selectedTopicId={undefined}
        onTopicSelect={(topicId) => {
          router.push(`/?topic=${topicId}`)
          setIsMobileMenuOpen(false)
        }}
        onCreateTopic={() => {
          setIsMobileMenuOpen(false)
          router.push("/")
        }}
        onAllTopicsClick={() => {
          setIsMobileMenuOpen(false)
          router.push("/?topics=1")
        }}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        refreshTrigger={0}
        accentColor="#2c64f6"
        mobileOnly
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden pt-[6.5rem] md:pt-14">
        <Suspense
          fallback={
            <div className="mx-auto flex min-h-0 flex-1 w-full max-w-[88rem] items-center justify-center px-4 py-4 text-sm text-muted-foreground">
              Yükleniyor…
            </div>
          }
        >
          <MessagesInboxView />
        </Suspense>
      </main>
    </div>
  )
}
