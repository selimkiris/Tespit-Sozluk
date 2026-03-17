"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Lock, FileText } from "lucide-react"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { EntryCard } from "@/components/entry-card"
import { Button } from "@/components/ui/button"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import { getAuth, clearAuth } from "@/lib/auth"

type UserProfile = {
  id: string
  nickname: string
  totalEntryCount: number
  email?: string | null
}

type ApiEntry = {
  id: string
  topicId: string
  topicTitle: string
  content: string
  authorId: string
  authorName: string
  createdAt: string
  upvotes: number
  downvotes: number
  userVoteType?: number
}

function mapEntry(e: ApiEntry) {
  const userVote: "up" | "down" | null =
    e.userVoteType === 1 ? "up" : e.userVoteType === -1 ? "down" : null
  return {
    id: String(e.id),
    topicId: String(e.topicId),
    topicTitle: e.topicTitle ?? "",
    content: e.content,
    author: { id: String(e.authorId), nickname: e.authorName },
    date: e.createdAt,
    upvotes: e.upvotes,
    downvotes: e.downvotes,
    userVote,
  }
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === "string" ? params.id : params.id?.[0]

  const [user, setUser] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<ReturnType<typeof mapEntry>[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [auth, setAuth] = useState<{ token: string; user: { id: string } } | null>(null)

  const fetchUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(getApiUrl(`api/Users/${userId}`), {
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error("Profil yüklenemedi")
      }
      const data = await res.json()
      return {
        id: String(data.id),
        nickname: data.nickname ?? "Anonim",
        totalEntryCount: data.totalEntryCount ?? 0,
        email: data.email ?? null,
      }
    } catch {
      return null
    }
  }, [])

  const fetchEntries = useCallback(async (userId: string, p: number) => {
    setEntriesLoading(true)
    try {
      const res = await fetch(
        getApiUrl(`api/Users/${userId}/entries?page=${p}&pageSize=20`),
        { headers: getAuthHeaders() }
      )
      if (!res.ok) throw new Error("Entry'ler yüklenemedi")
      const data = await res.json()
      const items = (data.items ?? []).map(mapEntry)
      setEntries(items)
      setTotalPages(data.totalPages ?? 1)
      setHasNextPage(data.hasNextPage ?? false)
      setHasPreviousPage(data.hasPreviousPage ?? false)
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [])

  useEffect(() => {
    setAuth(getAuth())
  }, [])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setIsLoading(true)
    fetchUser(id).then((u) => {
      if (!cancelled) {
        setUser(u ?? null)
        setIsLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [id, fetchUser])

  useEffect(() => {
    if (!id || !user) return
    fetchEntries(id, page)
  }, [id, user, page, fetchEntries])

  const handleTopicClick = useCallback((topicId: string) => {
    router.push(`/?topic=${topicId}`)
  }, [router])

  const isLoggedIn = !!auth?.token

  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Geçersiz kullanıcı</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Yükleniyor...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Kullanıcı bulunamadı</p>
        <Link href="/">
          <Button variant="outline">Ana Sayfaya Dön</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        isLoggedIn={isLoggedIn}
        user={auth?.user ? { name: auth.user.nickname, email: auth.user.email } : undefined}
        onLoginClick={() => router.push("/?login=1")}
        onRegisterClick={() => router.push("/?register=1")}
        onLogout={() => { clearAuth(); window.location.href = "/" }}
        onProfileClick={() => auth?.user?.id && router.push(`/user/${auth.user.id}`)}
        onMenuClick={() => {}}
        isMobileMenuOpen={false}
        onHomeClick={() => router.push("/")}
        onAllTopicsClick={() => router.push("/?topics=1")}
        onTopicSelect={(topicId) => router.push(`/?topic=${topicId}`)}
        onUserSelect={(userId) => router.push(`/user/${userId}`)}
      />

      <main className="pt-14">
        {/* Header / Cover */}
        <div className="border-b border-border bg-card">
          <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Ana Sayfa
              </Button>
            </Link>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {user.nickname}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                Toplam Entry: {user.totalEntryCount}
              </span>
              {user.email && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/80 text-sm text-muted-foreground border border-border/50">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>{user.email}</span>
                  <span className="text-xs text-muted-foreground/80 ml-1">• Sadece sen görebilirsin</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Entry List */}
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
            Entry&apos;ler
          </h2>

          {entriesLoading ? (
            <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Henüz entry girilmemiş.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  showTopicTitle={true}
                  onTopicClick={handleTopicClick}
                  isLoggedIn={isLoggedIn}
                  onLoginClick={() => router.push("/?login=1")}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {(hasPreviousPage || hasNextPage) && (
            <div className="flex items-center justify-center gap-3 mt-8 pb-8">
              <Button
                variant="outline"
                size="sm"
                disabled={!hasPreviousPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Önceki Sayfa
              </Button>
              <span className="text-sm text-muted-foreground">
                Sayfa {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki Sayfa
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
