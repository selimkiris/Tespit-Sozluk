"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Clock, Compass, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Navbar } from "@/components/navbar"
import { TopicSidebar } from "@/components/topic-sidebar"
import { EntryCard } from "@/components/entry-card"
import { TopicDetail } from "@/components/topic-detail"
import { LoginModal, RegisterModal, type AuthResponse } from "@/components/auth-modals"
import { CreateTopicModal } from "@/components/create-topic-modal"
import { AllTopicsView } from "@/components/all-topics-view"
import { saveAuth, getAuth, clearAuth, updateAuthUser } from "@/lib/auth"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import { TOPIC_ENTRIES_PAGE_SIZE } from "@/lib/topic-entries"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"
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

type SidebarTopicPayload = {
  id: string
  title?: string
  entryCount?: number
  authorId?: string
  authorName?: string
  authorUsername?: string
  authorAvatar?: string | null
  createdAt?: string
  isAnonymous?: boolean
  isTopicOwner?: boolean
  isFollowedByCurrentUser?: boolean
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
  const [topics, setTopics] = useState<{
    id: string
    title: string
    entryCount: number
    authorId?: string
    authorName?: string
    authorUsername?: string
    authorAvatar?: string | null
    createdAt?: string
    isAnonymous?: boolean
    isTopicOwner?: boolean
    isFollowedByCurrentUser?: boolean
  }[]>([])
  const [entries, setEntries] = useState<ReturnType<typeof mapApiEntry>[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleTopicsLoaded = useCallback((payload: SidebarTopicPayload[] | { items?: SidebarTopicPayload[] }) => {
    const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : [])
    const mapped = list.map((t) => ({
      id: String(t.id),
      title: String(t.title ?? ""),
      entryCount: typeof t.entryCount === "number" ? t.entryCount : 0,
      authorId: t.authorId != null && t.authorId !== "" ? String(t.authorId) : undefined,
      authorName: typeof t.authorName === "string" ? t.authorName : undefined,
      authorUsername: typeof t.authorUsername === "string" ? t.authorUsername : undefined,
      authorAvatar: t.authorAvatar != null ? String(t.authorAvatar) : undefined,
      createdAt: typeof t.createdAt === "string" ? t.createdAt : undefined,
      isAnonymous: t.isAnonymous === true,
      isTopicOwner: t.isTopicOwner === true,
      isFollowedByCurrentUser: t.isFollowedByCurrentUser === true,
    }))
    setTopics(mapped)
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
  const topicEntriesPageFromUrl = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
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
  const [fetchedTopicForUrl, setFetchedTopicForUrl] = useState<{
    id: string
    title: string
    entryCount: number
    authorId?: string
    authorName?: string
    authorUsername?: string
    authorAvatar?: string | null
    createdAt?: string
    isAnonymous?: boolean
    isTopicOwner?: boolean
    isFollowedByCurrentUser?: boolean
  } | null>(null)

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
          authorId: topicData?.authorId != null && topicData?.authorId !== "" ? String(topicData.authorId) : undefined,
          authorName: topicData?.authorName,
          authorUsername: topicData?.authorUsername,
          authorAvatar: topicData?.authorAvatar ?? null,
          createdAt: topicData?.createdAt,
          isAnonymous: topicData?.isAnonymous === true,
          isTopicOwner: topicData?.isTopicOwner === true,
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

  const handleTopicEntriesPageUrlChange = useCallback(
    (page: number) => {
      if (!selectedTopicId) return
      const p = Math.max(1, page)
      const urlTopic = searchParams.get("topic")
      const pageRaw = searchParams.get("page")
      const currentPage = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1)
      if (urlTopic === selectedTopicId && currentPage === p) return
      router.replace(`/?topic=${selectedTopicId}&page=${p}`, { scroll: false })
    },
    [router, selectedTopicId, searchParams]
  )

  const handleCreateTopic = useCallback(
    async (title: string, firstEntry: string, isAnonymous: boolean = false): Promise<string | null> => {
      if (!currentUser) return null
      const auth = getAuth()
      if (!auth?.token) return null

      try {
        const createTopicRes = await fetch(getApiUrl("api/Topics"), {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            title: title.trim(),
            isAnonymous,
            firstEntryContent: firstEntry.trim(),
          }),
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
          authorId: isAnonymous ? undefined : currentUser.id,
          isAnonymous: Boolean(topicData.isAnonymous ?? isAnonymous),
          isTopicOwner: topicData.isTopicOwner !== false,
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
    async (content: string, isAnonymous: boolean = false, onApiSuccess?: () => void): Promise<void> => {
      if (!currentUser || !selectedTopicId || !selectedTopic) {
        onApiSuccess?.()
        return
      }

      const fallbackEntryCount = (): number => {
        const ec: unknown = selectedTopic.entryCount
        if (typeof ec === "number" && !isNaN(ec) && isFinite(ec)) return ec + 1
        if (typeof ec === "string" && ec.trim() !== "") {
          const n = Number(ec)
          if (!isNaN(n) && isFinite(n)) return n + 1
        }
        const n = Number(ec)
        return (!isNaN(n) && isFinite(n) ? n : 0) + 1
      }

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

        let newCount = fallbackEntryCount()
        try {
          const topicRes = await fetch(getApiUrl(`api/Topics/${selectedTopicId}`), { headers: getAuthHeaders() })
          if (topicRes.ok) {
            const freshTopic = await topicRes.json().catch(() => null)
            if (freshTopic && typeof freshTopic === "object") {
              const ft = freshTopic as Record<string, unknown> & { data?: { entryCount?: unknown } }
              const fetchedCount = ft.entryCount ?? ft.EntryCount ?? ft.data?.entryCount
              if (typeof fetchedCount === "number" && !isNaN(fetchedCount) && isFinite(fetchedCount)) {
                newCount = fetchedCount
              } else if (typeof fetchedCount === "string" && fetchedCount.trim() !== "") {
                const parsed = Number(fetchedCount)
                if (!isNaN(parsed) && isFinite(parsed)) {
                  newCount = parsed
                }
              }
            }
          }
        } catch {
          // API çöktüyse fallback count kullan — ?page=NaN asla oluşmaz
        }

        // Kesinlikle geçerli bir sayı olduğundan emin ol
        const safeCount =
          typeof newCount === "number" && !isNaN(newCount) && isFinite(newCount) && newCount > 0
            ? newCount
            : fallbackEntryCount()
        const exactLastPage = Math.max(1, Math.ceil(safeCount / TOPIC_ENTRIES_PAGE_SIZE) || 1)
        const currentPageFromUrl = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)

        setTopics((prev) =>
          (Array.isArray(prev) ? prev : []).map((t) =>
            t.id === selectedTopicId ? { ...t, entryCount: safeCount } : t
          )
        )
        setFetchedTopicForUrl((prev) =>
          prev && prev.id === selectedTopicId ? { ...prev, entryCount: safeCount } : prev
        )

        if (typeof window !== "undefined") {
          sessionStorage.setItem("scrollToNewEntry", "true")
        }
        await router.push(`/?topic=${selectedTopicId}&page=${exactLastPage}`, { scroll: false })
        // Aynı sayfada kalındığında (son sayfa / tek sayfa) router.push URL'i değiştirmez; liste yenilenmez.
        // Hedef sayfa mevcut URL sayfasıyla aynıysa TopicDetail'deki fetchEntries'i refreshTrigger ile zorunlu tetikle.
        if (currentPageFromUrl === exactLastPage) {
          setRefreshTrigger((t) => t + 1)
        }

        onApiSuccess?.()
      } catch (err) {
        throw err
      }
    },
    [currentUser, selectedTopicId, selectedTopic, router, searchParams]
  )

  // Home handler
  const handleHomeClick = useCallback(() => {
    setSelectedTopicId(null)
    router.replace("/", { scroll: false })
  }, [router])

  // Bukalemun renk hesabı: hangi sekme/sayfa aktifse ona göre tema rengi
  const accentColor = selectedTopicId
    ? "#2c64f6"
    : feedMode === "discover"
      ? "#f28f35"
      : feedMode === "following"
        ? "#55d197"
        : "#2c64f6"

  return (
    <div className="min-h-screen bg-background" suppressHydrationWarning>
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
        accentColor={accentColor}
      />

      {/* Sidebar */}
      <TopicSidebar
        topics={topicsList}
        selectedTopicId={selectedTopicId ?? undefined}
        onTopicSelect={handleTopicSelect}
        onCreateTopic={() => setShowCreateTopicModal(true)}
        onAllTopicsClick={() => setShowAllTopicsModal(true)}
        onTopicsLoaded={handleTopicsLoaded}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        refreshTrigger={refreshTrigger}
        accentColor={accentColor}
      />

      {/* Main Content — lg+: sola yaslı; pl = sidebar + gap-8 */}
      <main className="w-full min-w-0 pt-14 md:pt-14 lg:flex lg:justify-start lg:pl-[312px] xl:pl-[344px]">
        <div
          className={cn(
            "w-full min-w-0 mx-auto px-4 py-4 lg:mx-0 lg:px-6 lg:py-6",
            FEED_COLUMN_MAX_WIDTH_CLASS
          )}
        >
          {selectedTopic ? (
            <TopicDetail
              topic={selectedTopic}
              isLoggedIn={isLoggedIn}
              currentUser={currentUser}
              onBack={() => setSelectedTopicId(null)}
              onSubmitEntry={handleSubmitEntry}
              onLoginClick={() => setShowLoginModal(true)}
              onTopicChange={() => setRefreshTrigger((t) => t + 1)}
              refreshTrigger={refreshTrigger}
              entriesPageFromUrl={topicEntriesPageFromUrl}
              onEntriesPageUrlChange={handleTopicEntriesPageUrlChange}
            />
          ) : (
            <>
              <div className="mb-5">
                <nav
                  className="flex border-b border-[#3a3b3c]"
                  role="tablist"
                  aria-label="Feed seçimi"
                >
                  {(
                    [
                      {
                        mode: "recent",
                        label: "Son Entryler",
                        Icon: Clock,
                        activeIcon: "text-[#2c64f6]",
                        activeLabel: "text-[#2c64f6]",
                        activeBorder: "border-[#2c64f6]",
                        hoverIcon: "group-hover:text-[#2c64f6]/70",
                        hoverBg: "group-hover:bg-[#2c64f6]/10",
                      },
                      {
                        mode: "discover",
                        label: "Keşfet",
                        Icon: Compass,
                        activeIcon: "text-orange-400",
                        activeLabel: "text-orange-400",
                        activeBorder: "border-orange-400",
                        hoverIcon: "group-hover:text-orange-300",
                        hoverBg: "group-hover:bg-orange-500/10",
                      },
                      {
                        mode: "following",
                        label: "Takip Ettiklerim",
                        Icon: Users,
                        activeIcon: "text-emerald-400",
                        activeLabel: "text-emerald-400",
                        activeBorder: "border-emerald-400",
                        hoverIcon: "group-hover:text-emerald-300",
                        hoverBg: "group-hover:bg-emerald-500/10",
                      },
                    ] as const
                  ).map(({ mode, label, Icon, activeIcon, activeLabel, activeBorder, hoverIcon, hoverBg }) => {
                    const isActive = feedMode === mode
                    const isRecentActive = mode === "recent" && isActive
                    return (
                      <button
                        key={mode}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleFeedModeChange(mode)}
                        className={cn(
                          "group flex flex-1 flex-col items-center justify-center gap-1 px-3 py-2 transition-all duration-200 focus-visible:outline-none -mb-[1px] border-b-[3px]",
                          isActive ? activeBorder : "border-transparent",
                          isRecentActive && "brightness-125 saturate-150"
                        )}
                      >
                        <div
                          className={cn(
                            "flex items-center justify-center w-11 h-11 rounded-full transition-all duration-200",
                            isActive ? "" : hoverBg
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-6 w-6 shrink-0 transition-colors duration-200",
                              isRecentActive
                                ? "text-[#2c64f6]"
                                : isActive
                                  ? activeIcon
                                  : cn("text-[#6b7280]", hoverIcon)
                            )}
                          />
                        </div>
                        <span
                          className={cn(
                            "text-xs font-semibold tracking-wide transition-colors duration-200 truncate",
                            isRecentActive
                              ? "text-[#2c64f6]"
                              : isActive
                                ? activeLabel
                                : cn("text-[#6b7280]", hoverIcon)
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    )
                  })}
                </nav>
              </div>
              <div className="space-y-4 min-w-0 w-full max-w-full">
                {entriesLoading && feedEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <span>Yükleniyor...</span>
                  </div>
                ) : (
                <>
                {feedMode === "following" && feedEntries.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-10">
                    Henüz takip ettiğiniz yazar veya başlık yok.
                  </p>
                ) : (
                  feedEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      showTopicTitle={true}
                      activeTab={feedMode}
                      onTopicClick={handleTopicSelect}
                      isLoggedIn={isLoggedIn}
                      onLoginClick={() => setShowLoginModal(true)}
                      currentUser={currentUser}
                      onEntryChange={() => setRefreshTrigger((t) => t + 1)}
                    />
                  ))
                )}
                {feedHasNextPage && feedEntries.length > 0 && (
                  <div className="pt-4 flex justify-center">
                    <button
                      onClick={handleFeedLoadMore}
                      disabled={feedLoadingMore}
                      className="px-6 py-3 rounded-lg border border-border bg-card hover:bg-secondary/50 text-sm font-medium text-foreground transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span>{feedLoadingMore ? "Yükleniyor..." : "Daha Fazla Göster"}</span>
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
