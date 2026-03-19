"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { TopicSidebar } from "@/components/topic-sidebar"
import { EntryCard } from "@/components/entry-card"
import { TopicDetail } from "@/components/topic-detail"
import { LoginModal, RegisterModal, type AuthResponse } from "@/components/auth-modals"
import { CreateTopicModal } from "@/components/create-topic-modal"
import { AllTopicsView } from "@/components/all-topics-view"
import { saveAuth, getAuth, clearAuth, updateAuthUser } from "@/lib/auth"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import { toast } from "sonner"

type ApiEntry = {
  id: string
  topicId: string
  topicTitle: string
  content: string
  authorId: string
  authorName: string
  authorAvatar?: string | null
  authorRole?: string
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

function mapApiEntry(e: ApiEntry) {
  const userVote: "up" | "down" | null =
    e.userVoteType === 1 ? "up" : e.userVoteType === -1 ? "down" : null
  return {
    id: String(e.id),
    topicId: String(e.topicId),
    topicTitle: e.topicTitle ?? "",
    content: e.content,
    author: { id: String(e.authorId), nickname: e.authorName, avatar: e.authorAvatar ?? null, role: e.authorRole ?? "User" },
    date: e.createdAt,
    updatedAt: e.updatedAt ?? null,
    upvotes: e.upvotes,
    downvotes: e.downvotes,
    userVote,
    validBkzs: e.validBkzs ?? null,
    isAnonymous: e.isAnonymous ?? false,
    canManage: e.canManage ?? false,
    saveCount: e.saveCount ?? 0,
    isSavedByCurrentUser: e.isSavedByCurrentUser ?? false,
  }
}

type User = {
  id: string
  nickname: string
  email: string
  joinDate: string
  name: string
  avatar?: string | null
  hasChangedUsername?: boolean
  role?: string
}

function authResponseToUser(auth: AuthResponse): User {
  const displayName = auth.username?.trim() || (auth.firstName ? `${auth.firstName}${auth.lastName ? ` ${auth.lastName}` : ""}`.trim() : "") || auth.email
  return {
    id: auth.userId,
    nickname: displayName,
    email: auth.email,
    joinDate: new Date().toISOString().split("T")[0],
    name: displayName,
    avatar: auth.avatar ?? null,
    hasChangedUsername: auth.hasChangedUsername ?? false,
    role: auth.role ?? "User",
  }
}

export function HomePageContent() {
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
  const [topics, setTopics] = useState<{ id: string; title: string; entryCount: number; authorId?: string; isFollowedByCurrentUser?: boolean }[]>([])
  const [entries, setEntries] = useState<ReturnType<typeof mapApiEntry>[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTopicsLoaded = useCallback((payload: { id: string; title: string; entryCount: number; authorId?: string; isFollowedByCurrentUser?: boolean }[] | { items?: { id: string; title: string; entryCount?: number; authorId?: string; isFollowedByCurrentUser?: boolean }[] }) => {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items.map((t) => ({
            id: String(t.id),
            title: t.title ?? "",
            entryCount: t.entryCount ?? 0,
            authorId: t.authorId,
            isFollowedByCurrentUser: t.isFollowedByCurrentUser,
          }))
        : []
    setTopics(list)
  }, [])

  const [feedPage, setFeedPage] = useState(1)
  const [feedHasNextPage, setFeedHasNextPage] = useState(false)
  const [feedLoadingMore, setFeedLoadingMore] = useState(false)

  const [feedMode, setFeedMode] = useState<"recent" | "following" | "discover">("recent")

  const fetchFeedEntries = useCallback(async (pageNum: number = 1, append: boolean = false, mode?: "recent" | "following" | "discover") => {
    const effectiveMode = mode ?? feedMode
    if (append) {
      setFeedLoadingMore(true)
    } else {
      setEntriesLoading(true)
    }
    try {
      const url = getApiUrl(`api/Entries/feed?feedMode=${effectiveMode}&page=${pageNum}&pageSize=50`)
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
  }, [feedMode])

  // selectedTopicId, feedMode veya refreshTrigger değiştiğinde feed'i güncelle
  useEffect(() => {
    if (!selectedTopicId) {
      setFeedPage(1)
      fetchFeedEntries(1, false)
    }
  }, [selectedTopicId, feedMode, fetchFeedEntries, refreshTrigger])

  const handleFeedLoadMore = useCallback(() => {
    fetchFeedEntries(feedPage + 1, true)
  }, [feedPage, fetchFeedEntries])

  const handleFeedModeChange = useCallback((mode: "recent" | "following" | "discover") => {
    setFeedMode(mode)
    setFeedPage(1)
  }, [])

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
  const searchFromUrl = searchParams.get("search")

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
  const [fetchedTopicForUrl, setFetchedTopicForUrl] = useState<{ id: string; title: string; entryCount: number; authorId?: string; isFollowedByCurrentUser?: boolean } | null>(null)

  // URL'den gelen topic listede yoksa (örn. sayfa 2'deki başlık) entries API'den minimal topic türet
  useEffect(() => {
    if (!selectedTopicId || selectedTopicFromList) {
      setFetchedTopicForUrl(null)
      return
    }
    let cancelled = false
    const fetchTopic = async () => {
      try {
        const [entriesRes, topicRes] = await Promise.all([
          fetch(getApiUrl(`api/Topics/${selectedTopicId}/entries?page=1&pageSize=1`), { headers: getAuthHeaders() }),
          fetch(getApiUrl(`api/Topics/${selectedTopicId}`), { headers: getAuthHeaders() }),
        ])
        if (cancelled) return
        const data = entriesRes.ok ? await entriesRes.json() : null
        const topicData = topicRes.ok ? await topicRes.json() : null
        const first = data?.items?.[0]
        setFetchedTopicForUrl({
          id: selectedTopicId,
          title: first?.topicTitle ?? topicData?.title ?? "Başlık",
          entryCount: data?.totalCount ?? topicData?.entryCount ?? 0,
          isFollowedByCurrentUser: topicData?.isFollowedByCurrentUser,
        })
      } catch {
        if (!cancelled) setFetchedTopicForUrl(null)
      }
    }
    fetchTopic()
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
    async (title: string, firstEntry: string, isAnonymous: boolean = false): Promise<string | null> => {
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
        if (createTopicRes.status === 429) {
          const seconds = Math.ceil(topicData.retryAfterSeconds ?? 60)
          toast.warning(`Çok hızlı gidiyorsun! Yeni bir işlem yapmak için ${seconds} saniye beklemen gerekiyor ⏳`, {
            duration: 7000,
            style: { background: "#78350f", color: "#fef3c7", border: "1px solid #d97706" },
          })
          throw new Error("")
        }
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
          body: JSON.stringify({ topicId, content: firstEntry.trim(), isAnonymous }),
        })
        const entryData = await createEntryRes.json().catch(() => ({}))
        if (createEntryRes.status === 429) {
          const seconds = Math.ceil(entryData.retryAfterSeconds ?? 60)
          toast.warning(`Çok hızlı gidiyorsun! Yeni bir işlem yapmak için ${seconds} saniye beklemen gerekiyor ⏳`, {
            duration: 7000,
            style: { background: "#78350f", color: "#fef3c7", border: "1px solid #d97706" },
          })
          throw new Error("")
        }
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
    async (content: string, isAnonymous: boolean = false): Promise<void> => {
      if (!currentUser || !selectedTopicId) return

      try {
        const res = await fetch(getApiUrl("api/Entries"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ topicId: selectedTopicId, content: content.trim(), isAnonymous }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          const seconds = Math.ceil(data.retryAfterSeconds ?? 60)
          toast.warning(`Çok hızlı gidiyorsun! Yeni bir işlem yapmak için ${seconds} saniye beklemen gerekiyor ⏳`, {
            duration: 7000,
            style: { background: "#78350f", color: "#fef3c7", border: "1px solid #d97706" },
          })
          throw new Error("")
        }
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
        user={currentUser ? { name: currentUser.name, email: currentUser.email, avatar: currentUser.avatar, hasChangedUsername: currentUser.hasChangedUsername, role: currentUser.role } : undefined}
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
        onUserUpdate={(updates) => {
          const updated = updateAuthUser(updates)
          if (updated) setCurrentUser(updated)
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
                <nav className="flex gap-6 border-b border-border pb-2" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    onClick={() => handleFeedModeChange("recent")}
                    className={`text-sm font-medium transition-colors pb-1 -mb-0.5 border-b-2 ${
                      feedMode === "recent"
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Son Girilen Entryler
                  </button>
                  <button
                    type="button"
                    role="tab"
                    onClick={() => handleFeedModeChange("discover")}
                    className={`text-sm font-medium transition-colors pb-1 -mb-0.5 border-b-2 ${
                      feedMode === "discover"
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Keşfet
                  </button>
                  <button
                    type="button"
                    role="tab"
                    onClick={() => handleFeedModeChange("following")}
                    className={`text-sm font-medium transition-colors pb-1 -mb-0.5 border-b-2 ${
                      feedMode === "following"
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Takip Ettiklerim
                  </button>
                </nav>
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
        initialSearchQuery={searchFromUrl}
      />
    </div>
  )
}
