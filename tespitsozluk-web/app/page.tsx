"use client"

import { useState, useCallback, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { TopicSidebar } from "@/components/topic-sidebar"
import { EntryCard } from "@/components/entry-card"
import { TopicDetail } from "@/components/topic-detail"
import { LoginModal, RegisterModal, type AuthResponse } from "@/components/auth-modals"
import { CreateTopicModal } from "@/components/create-topic-modal"
import { AllTopicsView } from "@/components/all-topics-view"
import { saveAuth, getAuth, clearAuth } from "@/lib/auth"
import { getApiUrl, getAuthHeaders } from "@/lib/api"

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

function mapApiEntry(e: ApiEntry) {
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

type User = {
  id: string
  nickname: string
  email: string
  joinDate: string
  name: string
}

function authResponseToUser(auth: AuthResponse): User {
  const displayName = auth.firstName ? `${auth.firstName}${auth.lastName ? ` ${auth.lastName}` : ""}`.trim() || auth.email : auth.email
  return {
    id: auth.userId,
    nickname: displayName,
    email: auth.email,
    joinDate: new Date().toISOString().split("T")[0],
    name: displayName,
  }
}

function HomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false)
  const [showAllTopicsModal, setShowAllTopicsModal] = useState(false)

  // Navigation state
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  // Data state (topics API'den TopicSidebar ile yüklenecek)
  const [topics, setTopics] = useState<{ id: string; title: string; entryCount: number; authorId?: string }[]>([])
  const [entries, setEntries] = useState<ReturnType<typeof mapApiEntry>[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTopicsLoaded = useCallback((payload: { id: string; title: string; entryCount: number; authorId?: string }[] | { items?: { id: string; title: string; entryCount?: number; authorId?: string }[] }) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items.map((t) => ({
            id: String(t.id),
            title: t.title ?? "",
            entryCount: t.entryCount ?? 0,
            authorId: t.authorId,
          }))
        : []
    setTopics(list)
  }, [])

  const [feedPage, setFeedPage] = useState(1)
  const [feedHasNextPage, setFeedHasNextPage] = useState(false)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)

  const fetchFeedEntries = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setFeedLoadingMore(true)
    } else {
      setEntriesLoading(true)
    }
    try {
      const url = getApiUrl(`api/Entries/feed?page=${pageNum}&pageSize=50`)
      const res = await fetch(url, { headers: getAuthHeaders() })
      if (!res.ok) throw new Error("Entries yüklenemedi")
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items.map(mapApiEntry) : []
      setFeedHasNextPage(data?.hasNextPage ?? false)
      setFeedPage(pageNum)
      setEntries((prev) => (append ? [...prev, ...list] : list))
    } catch {
      if (!append) setEntries([])
    } finally {
      setEntriesLoading(false)
      setFeedLoadingMore(false)
    }
  }, [])

  // selectedTopicId değiştiğinde (sayfa geçişi) veya refreshTrigger (vote/entry) sonrası feed'i güncelle
  useEffect(() => {
    if (!selectedTopicId) {
      setFeedPage(1)
      fetchFeedEntries(1, false)
    }
  }, [selectedTopicId, fetchFeedEntries, refreshTrigger])

  const handleFeedLoadMore = useCallback(() => {
    fetchFeedEntries(feedPage + 1, true)
  }, [feedPage, fetchFeedEntries])

  // Restore auth from localStorage on mount
  useEffect(() => {
    const stored = getAuth()
    if (stored) {
      setCurrentUser(stored.user)
      setIsLoggedIn(true)
    }
  }, [])

  const topicFromUrl = searchParams.get("topic")
  const loginFromUrl = searchParams.get("login")
  const registerFromUrl = searchParams.get("register")
  const topicsFromUrl = searchParams.get("topics")

  // URL'deki topic parametresi tek kaynak — selectedTopicId buna göre güncellenir
  useEffect(() => {
    if (topicFromUrl) {
      setSelectedTopicId(topicFromUrl)
    } else if (!loginFromUrl && !registerFromUrl && !topicsFromUrl) {
      setSelectedTopicId(null)
    }
  }, [topicFromUrl, loginFromUrl, registerFromUrl, topicsFromUrl])

  useEffect(() => {
    if (loginFromUrl === "1") setShowLoginModal(true)
  }, [loginFromUrl])

  useEffect(() => {
    if (registerFromUrl === "1") setShowRegisterModal(true)
  }, [registerFromUrl])

  useEffect(() => {
    if (topicsFromUrl === "1") setShowAllTopicsModal(true)
  }, [topicsFromUrl])

  const feedEntries = entries

  // Get selected topic (güvenli erişim - topics asla undefined olmasın)
  const topicsList = topics ?? []
  const selectedTopicFromList = topicsList.find((t) => t.id === selectedTopicId)
  const [fetchedTopicForUrl, setFetchedTopicForUrl] = useState<{ id: string; title: string; entryCount: number; authorId?: string } | null>(null)

  // URL'den gelen topic listede yoksa (örn. sayfa 2'deki başlık) entries API'den minimal topic türet
  useEffect(() => {
    if (!selectedTopicId || selectedTopicFromList) {
      setFetchedTopicForUrl(null)
      return
    }
    let cancelled = false
    fetch(getApiUrl(`api/Topics/${selectedTopicId}/entries?page=1&pageSize=1`), { headers: getAuthHeaders() })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return
        const first = data?.items?.[0]
        setFetchedTopicForUrl({
          id: selectedTopicId,
          title: first?.topicTitle ?? "Başlık",
          entryCount: data?.totalCount ?? 0,
        })
      })
      .catch(() => setFetchedTopicForUrl(null))
    return () => { cancelled = true }
  }, [selectedTopicId, selectedTopicFromList])

  const selectedTopic = selectedTopicFromList ?? fetchedTopicForUrl

  // Auth handlers
  const handleLogin = useCallback((auth: AuthResponse) => {
    const user = authResponseToUser(auth)
    saveAuth(auth.token, user)
    setCurrentUser(user)
    setIsLoggedIn(true)
    setShowLoginModal(false)
  }, [])

  const handleRegister = useCallback((auth: AuthResponse) => {
    const user = authResponseToUser(auth)
    saveAuth(auth.token, user)
    setCurrentUser(user)
    setIsLoggedIn(true)
    setShowRegisterModal(false)
  }, [])

  const handleLogout = useCallback(() => {
    clearAuth()
    setIsLoggedIn(false)
    setCurrentUser(null)
  }, [])

  // Topic handlers - URL ile senkron, sayfa geçişleri refreshTrigger'a muhtaç değil
  const handleTopicSelect = useCallback((topicId: string) => {
    setSelectedTopicId(topicId)
    router.replace(`/?topic=${topicId}`, { scroll: false })
  }, [router])

  const handleCreateTopic = useCallback(
    async (title: string, firstEntry: string): Promise<string | null> => {
      if (!currentUser) return null
      const auth = getAuth()
      if (!auth?.token) return null

      try {
        const createTopicRes = await fetch(getApiUrl("api/Topics"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title: title.trim() }),
        })
        const topicData = await createTopicRes.json().catch(() => ({}))
        if (!createTopicRes.ok) {
          throw new Error(typeof topicData === "string" ? topicData : (topicData.title ?? topicData.message ?? "Başlık oluşturulamadı"))
        }
        const topicId = String(topicData.id)
        const newTopic = {
          id: topicId,
          title: topicData.title ?? title.trim(),
          entryCount: 1,
          authorId: currentUser.id,
        }

        const createEntryRes = await fetch(getApiUrl("api/Entries"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ topicId, content: firstEntry.trim() }),
        })
        const entryData = await createEntryRes.json().catch(() => ({}))
        if (!createEntryRes.ok) {
          throw new Error(typeof entryData === "string" ? entryData : (entryData.title ?? entryData.message ?? "İlk entry eklenemedi"))
        }

        setTopics((prev) => [newTopic, ...(Array.isArray(prev) ? prev : [])])
        setSelectedTopicId(topicId)
        setRefreshTrigger((t) => t + 1)
        return topicId
      } catch (err) {
        throw err
      }
    },
    [currentUser]
  )

  // Entry handlers
  const handleSubmitEntry = useCallback(
    async (content: string): Promise<void> => {
      if (!currentUser || !selectedTopicId) return

      try {
        const res = await fetch(getApiUrl("api/Entries"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ topicId: selectedTopicId, content: content.trim() }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(typeof data === "string" ? data : (data.title ?? data.message ?? "Entry eklenemedi"))
        }
        setRefreshTrigger((t) => t + 1)
      } catch (err) {
        throw err
      }
    },
    [currentUser, selectedTopicId]
  )

  // Home handler
  const handleHomeClick = useCallback(() => {
    setSelectedTopicId(null)
    router.replace("/", { scroll: false })
  }, [router])

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <Navbar
        isLoggedIn={isLoggedIn}
        user={currentUser ? { name: currentUser.name, email: currentUser.email } : undefined}
        onLoginClick={() => setShowLoginModal(true)}
        onRegisterClick={() => setShowRegisterModal(true)}
        onLogout={handleLogout}
        onProfileClick={() => currentUser && router.push(`/user/${currentUser.id}`)}
        onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onHomeClick={handleHomeClick}
        onAllTopicsClick={() => setShowAllTopicsModal(true)}
        onTopicSelect={handleTopicSelect}
        onUserSelect={(userId) => {
          router.push(`/user/${userId}`)
          setIsMobileMenuOpen(false)
        }}
      />

      {/* Sidebar */}
      <TopicSidebar
        topics={topicsList}
        selectedTopicId={selectedTopicId ?? undefined}
        onTopicSelect={handleTopicSelect}
        onCreateTopic={() => setShowCreateTopicModal(true)}
        onTopicsLoaded={handleTopicsLoaded}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        refreshTrigger={refreshTrigger}
      />

      {/* Main Content */}
      <main className="lg:pl-64 pt-14 md:pt-14">
        <div className="max-w-2xl mx-auto px-4 py-6 lg:py-8">
          {selectedTopic ? (
            <TopicDetail
              topic={selectedTopic}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onBack={() => setSelectedTopicId(null)}
              onSubmitEntry={handleSubmitEntry}
              onLoginClick={() => setShowLoginModal(true)}
              onVoteSuccess={() => setRefreshTrigger((t) => t + 1)}
              onTopicChange={() => setRefreshTrigger((t) => t + 1)}
              refreshTrigger={refreshTrigger}
            />
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-semibold text-foreground">Gündem</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  En son paylaşılan entry&apos;ler
                </p>
              </div>
              <div className="space-y-4">
                {entriesLoading && feedEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
                ) : (
                <>
                {feedEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    showTopicTitle={true}
                    onTopicClick={handleTopicSelect}
                    isLoggedIn={isLoggedIn}
                    onLoginClick={() => setShowLoginModal(true)}
                    onVoteSuccess={() => setRefreshTrigger((t) => t + 1)}
                    currentUser={currentUser}
                    onEntryChange={() => setRefreshTrigger((t) => t + 1)}
                  />
                ))}
                {feedHasNextPage && (
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={handleFeedLoadMore}
                      disabled={feedLoadingMore}
                      className="px-6 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 text-sm font-medium text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {feedLoadingMore ? "Yükleniyor..." : "Daha Fazla Göster"}
                    </button>
                  </div>
                )}
                </>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
        onSwitchToRegister={() => {
          setShowLoginModal(false)
          setShowRegisterModal(true)
        }}
      />

      <RegisterModal
        isOpen={showRegisterModal}
        onClose={() => setShowRegisterModal(false)}
        onRegister={handleRegister}
        onSwitchToLogin={() => {
          setShowRegisterModal(false)
          setShowLoginModal(true)
        }}
      />

      <CreateTopicModal
        isOpen={showCreateTopicModal}
        onClose={() => setShowCreateTopicModal(false)}
        onCreate={handleCreateTopic}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => {
          setShowCreateTopicModal(false)
          setShowLoginModal(true)
        }}
      />

      <AllTopicsView
        isOpen={showAllTopicsModal}
        onClose={() => setShowAllTopicsModal(false)}
        topics={topicsList}
        onTopicSelect={handleTopicSelect}
      />
    </div>
  )
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground">Yükleniyor...</p></div>}>
      <HomePageContent />
    </Suspense>
  )
}
