"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Bell, BellOff, Search, Flag, ShieldAlert, FolderOutput, User } from "lucide-react"
import { ShareMenuSub } from "@/components/share-menu"
import { getApiUrl, apiFetch, getSiteUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { EntryCard } from "@/components/entry-card"
import { EntryForm } from "@/components/entry-form"
import { TOPIC_ENTRIES_PAGE_SIZE } from "@/lib/topic-entries"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReportDialog } from "@/components/report-dialog"
import { cn } from "@/lib/utils"
import { clampTopicTitleRaw, normalizeTopicTitleForApi } from "@/lib/topic-title-input"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"
import { formatTurkeyDateOnly } from "@/lib/turkey-datetime"
import { NoviceBadge, shouldShowNoviceBadge } from "@/components/novice-badge"
import { TOPIC_TITLE_MAX_LENGTH } from "@/lib/topic.schema"
import { topicHref, topicPageHref } from "@/lib/topic-href"
import { DangerConfirmModal } from "@/components/admin/danger-confirm-modal"
import type { ApiPollDto, EntryPollSubmission } from "@/lib/entry-poll"

interface Entry {
  id: string
  topicId: string
  topicTitle: string
  content: string
  author: {
    id: string
    nickname: string
  }
  date: string
  upvotes: number
  downvotes: number
  userVote?: "up" | "down" | null
  /** Anonim entry'de author.id maskeli olsa bile API'den gelir. */
  canManage?: boolean
  isNovice?: boolean
}

interface Topic {
  id: string
  title: string
  /** SEO dostu URL parçası — varsa `/baslik/<slug>` rotası tercih edilir; yoksa `/?topic=<id>` fallback. */
  slug?: string
  entryCount: number
  authorId?: string
  authorName?: string
  authorUsername?: string
  authorAvatar?: string | null
  createdAt?: string
  isAnonymous?: boolean
  isTopicOwner?: boolean
  /** Backend: başlık sahibi ve tüm entry'ler aynı kullanıcıya ait. */
  canManageTopic?: boolean
  isFollowedByCurrentUser?: boolean
  authorRole?: string
  isNovice?: boolean
}

interface TopicDetailProps {
  topic: Topic
  isLoggedIn: boolean
  currentUser?: { id: string; role?: string } | null
  onBack: () => void
  onSubmitEntry: (
    content: string,
    isAnonymous: boolean,
    onApiSuccess: () => void,
    poll?: EntryPollSubmission | null,
  ) => void | Promise<void>
  onLoginClick: () => void
  onTopicChange?: () => void
  refreshTrigger?: number
  /** `?page=` ile eşleşen sayfa (başlık entry listesi). */
  entriesPageFromUrl: number
  onEntriesPageUrlChange: (page: number) => void
}

function mapApiEntry(e: { id: string; topicId: string; topicTitle: string; content: string; authorId: string; authorName: string; authorAvatar?: string | null; authorRole?: string; createdAt: string; updatedAt?: string | null; upvotes: number; downvotes: number; userVoteType?: number; validBkzs?: Record<string, string> | null; isAnonymous?: boolean; canManage?: boolean; saveCount?: number; isSavedByCurrentUser?: boolean; isNovice?: boolean; poll?: ApiPollDto | null }) {
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
    isNovice: e.isNovice ?? false,
    poll: e.poll ?? null,
  }
}

export function TopicDetail({
  topic,
  isLoggedIn,
  currentUser,
  onBack,
  onSubmitEntry,
  onLoginClick,
  onTopicChange,
  refreshTrigger = 0,
  entriesPageFromUrl,
  onEntriesPageUrlChange,
}: TopicDetailProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(entriesPageFromUrl)
  const [totalPages, setTotalPages] = useState(1)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [sortBy, setSortBy] = useState<string>("oldest")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(topic.title)
  const [editIsAnonymous, setEditIsAnonymous] = useState<boolean>(topic.isAnonymous ?? false)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isFollowed, setIsFollowed] = useState(topic.isFollowedByCurrentUser ?? false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
  const [topicDetail, setTopicDetail] = useState<Partial<Topic>>({})
  const [isReportOpen, setIsReportOpen] = useState(false)
  // Admin state
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false)
  const [isAdminDeleting, setIsAdminDeleting] = useState(false)
  const [isAdminRenameOpen, setIsAdminRenameOpen] = useState(false)
  const [adminRenameTitle, setAdminRenameTitle] = useState("")
  const [isAdminRenameSaving, setIsAdminRenameSaving] = useState(false)
  const [adminRenameError, setAdminRenameError] = useState<string | null>(null)
  const [isAdminMoveOpen, setIsAdminMoveOpen] = useState(false)
  const [adminMoveTargetId, setAdminMoveTargetId] = useState("")
  const [adminMoveSearchQuery, setAdminMoveSearchQuery] = useState("")
  const [adminMoveSearchResults, setAdminMoveSearchResults] = useState<{ id: string; title: string }[]>([])
  const [adminMoveSelectedTitle, setAdminMoveSelectedTitle] = useState("")
  const [isAdminMoving, setIsAdminMoving] = useState(false)
  const [adminMoveError, setAdminMoveError] = useState<string | null>(null)

  const isAdmin = currentUser?.role === "Admin"

  const entriesContainerRef = useRef<HTMLDivElement>(null)
  const titleLinkPointerStartRef = useRef<{ x: number; y: number } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const onEntriesPageUrlChangeRef = useRef(onEntriesPageUrlChange)
  onEntriesPageUrlChangeRef.current = onEntriesPageUrlChange

  /** Bekleyen sayfa navigasyonu: router.replace tamamlanmadan URL'deki eski `page` ile setPage çakışmasını önler. */
  const pendingPageFromNavigationRef = useRef<number | null>(null)

  useEffect(() => {
    setIsFollowed(topic.isFollowedByCurrentUser ?? false)
    setTopicDetail({})
  }, [topic.id, topic.isFollowedByCurrentUser])

  const fetchTopicFromApi = useCallback(async () => {
    try {
      const res = await apiFetch(getApiUrl(`api/Topics/${topic.id}`))
      if (!res.ok) return
      const d = await res.json()
      setTopicDetail({
        title: d.title,
        slug: typeof d.slug === "string" && d.slug.length > 0 ? d.slug : undefined,
        entryCount: typeof d.entryCount === "number" ? d.entryCount : undefined,
        authorId: d.authorId != null && d.authorId !== "" ? String(d.authorId) : undefined,
        authorName: d.authorName,
        authorUsername: d.authorUsername,
        authorAvatar: d.authorAvatar ?? null,
        createdAt: d.createdAt,
        isAnonymous: d.isAnonymous === true,
        isTopicOwner: d.isTopicOwner === true,
        canManageTopic: typeof d.canManageTopic === "boolean" ? d.canManageTopic : undefined,
        isFollowedByCurrentUser: d.isFollowedByCurrentUser,
        authorRole: typeof d.authorRole === "string" ? d.authorRole : undefined,
        isNovice: d.isNovice === true,
      })
      if (typeof d.isFollowedByCurrentUser === "boolean") {
        setIsFollowed(d.isFollowedByCurrentUser)
      }
    } catch {
      // ignore
    }
  }, [topic.id, refreshTrigger])

  useEffect(() => {
    void fetchTopicFromApi()
  }, [topic.id, refreshTrigger, fetchTopicFromApi])

  const handleToggleFollow = useCallback(async () => {
    if (!isLoggedIn || isFollowLoading) return
    setIsFollowLoading(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Topics/${topic.id}/follow`), {
        method: "POST",
      })
      if (res.ok) {
        const data = await res.json()
        setIsFollowed(data?.isFollowed ?? !isFollowed)
      }
    } catch {
      // ignore
    } finally {
      setIsFollowLoading(false)
    }
  }, [topic.id, isLoggedIn, isFollowLoading, isFollowed])

  const fetchEntries = useCallback(async (pageNum: number) => {
    setEntriesLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", String(pageNum))
      params.set("pageSize", String(TOPIC_ENTRIES_PAGE_SIZE))
      params.set("sortBy", sortBy)
      if (search.trim()) params.set("search", search.trim())
      const res = await apiFetch(getApiUrl(`api/Topics/${topic.id}/entries?${params.toString()}`))
      if (!res.ok) throw new Error("Entries yüklenemedi")
      const data = await res.json()
      const list = Array.isArray(data?.items) ? data.items.map(mapApiEntry) : []
      setEntries(list)
      setTotalPages(data?.totalPages ?? 1)
      setPage(pageNum)
    } catch {
      setEntries([])
    } finally {
      setEntriesLoading(false)
    }
  }, [topic.id, search, sortBy])

  const searchSortJustChanged = useRef(false)
  const firstTopicFilterEffect = useRef(true)

  useEffect(() => {
    firstTopicFilterEffect.current = true
    pendingPageFromNavigationRef.current = null
  }, [topic.id])

  useEffect(() => {
    if (firstTopicFilterEffect.current) {
      firstTopicFilterEffect.current = false
      return
    }
    pendingPageFromNavigationRef.current = 1
    setPage(1)
    searchSortJustChanged.current = true
    onEntriesPageUrlChangeRef.current(1)
  }, [topic.id, search, sortBy])

  useEffect(() => {
    const pending = pendingPageFromNavigationRef.current
    if (pending !== null) {
      if (entriesPageFromUrl === pending) {
        pendingPageFromNavigationRef.current = null
        setPage(entriesPageFromUrl)
      }
      return
    }
    setPage(entriesPageFromUrl)
  }, [topic.id, entriesPageFromUrl])

  useEffect(() => {
    const pageToFetch = searchSortJustChanged.current ? 1 : page
    if (searchSortJustChanged.current) searchSortJustChanged.current = false
    fetchEntries(pageToFetch)
  }, [topic.id, page, search, sortBy, refreshTrigger, fetchEntries])

  // Debounce arama: 400ms sonra search state güncellenir
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (entries && entries.length > 0 && typeof window !== "undefined") {
      if (sessionStorage.getItem("scrollToNewEntry") === "true") {
        // Flag'i hemen sil; 300ms içinde entries tekrar güncellenirse ikinci scroll tetiklenmez
        sessionStorage.removeItem("scrollToNewEntry")
        const t = window.setTimeout(() => {
          document.getElementById("bottom-of-entries")?.scrollIntoView({ behavior: "smooth" })
        }, 300)
        return () => window.clearTimeout(t)
      }
    }
  }, [entries])

  /** Bildirim / paylaşım derin linki: `/?topic=...#entry-{id}` — yüklendikten sonra ilgili entry'ye kaydır. */
  useEffect(() => {
    if (typeof window === "undefined" || entriesLoading) return
    const hash = window.location.hash
    if (!hash.startsWith("#entry-")) return
    const id = hash.slice(1)
    const el = document.getElementById(id)
    if (!el) return
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 100)
    return () => window.clearTimeout(t)
  }, [entries, entriesLoading, topic.id])

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") setSearch(searchInput.trim())
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return
    pendingPageFromNavigationRef.current = newPage
    setPage(newPage)
    onEntriesPageUrlChange(newPage)
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        document.getElementById("topic-top-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 0)
    }
  }

  const mergedTopic: Topic = {
    ...topic,
    ...topicDetail,
    title: topicDetail.title ?? topic.title,
    entryCount: topicDetail.entryCount ?? topic.entryCount,
  }

  const topicOpenedLabel = (() => {
    const raw = mergedTopic.createdAt
    if (!raw) return null
    return formatTurkeyDateOnly(raw)
  })()

  const topicAuthorDisplay =
    (mergedTopic.authorUsername || mergedTopic.authorName || "").trim() || "Yazar"

  const canManage =
    !!currentUser &&
    (typeof mergedTopic.canManageTopic === "boolean"
      ? mergedTopic.canManageTopic
      : mergedTopic.isTopicOwner === true &&
        !entriesLoading &&
        entries.every((e) => e.canManage === true))

  useEffect(() => {
    setEditTitle(mergedTopic.title)
    setEditIsAnonymous(mergedTopic.isAnonymous ?? false)
  }, [topic.id, mergedTopic.title, mergedTopic.isAnonymous])

  const handleEditTopic = async () => {
    const trimmed = normalizeTopicTitleForApi(editTitle)
    if (!trimmed) {
      setEditError("Başlık boş olamaz.")
      return
    }
    if (trimmed.length > TOPIC_TITLE_MAX_LENGTH) {
      setEditError(`Başlık en fazla ${TOPIC_TITLE_MAX_LENGTH} karakter olabilir.`)
      return
    }
    setIsEditSaving(true)
    setEditError(null)
    const url = getApiUrl(`api/Topics/${topic.id}`)
    const body = JSON.stringify({ title: trimmed, isAnonymous: editIsAnonymous })
    try {
      const res = await apiFetch(url, {
        method: "PUT",
        body,
      })
      const text = await res.text()
      const data = (() => {
        try { return text ? JSON.parse(text) : {} }
        catch { return typeof text === "string" ? { message: text } : {} }
      })()
      if (!res.ok) {
        const msg = typeof data === "string" ? data : (data.message || data.title || data.detail || text || "Düzenleme başarısız");
        console.error("[Topic Edit] API hatası:", res.status, res.statusText, { text, data })
        throw new Error(msg)
      }
      // Anında UI güncellemesi: header'daki yazar/anonim göstergesi yeni değere göre
      // re-render olsun diye topicDetail'i iyimser (optimistic) biçimde güncelliyoruz.
      // Ardından onTopicChange tam tazeliği getirmek üzere refetch tetikliyor.
      setTopicDetail((prev) => ({ ...prev, title: trimmed, isAnonymous: editIsAnonymous }))
      setIsEditOpen(false)
      onTopicChange?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bir hata oluştu"
      setEditError(message)
      console.error("[Topic Edit] Hata:", err)
    } finally {
      setIsEditSaving(false)
    }
  }

  const handleDeleteTopic = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Topics/${topic.id}`), {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data === "string" ? data : (data.message ?? data.title ?? "Silme başarısız")
        throw new Error(msg)
      }
      setIsDeleteOpen(false)
      onBack()
      onTopicChange?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAdminDeleteTopic = async () => {
    setIsAdminDeleting(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/topics/${topic.id}`), {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data === "string" ? data : (data.message ?? "Silme başarısız"))
      }
      setIsAdminDeleteOpen(false)
      onBack()
      onTopicChange?.()
    } finally {
      setIsAdminDeleting(false)
    }
  }

  const handleAdminRenameTopic = async () => {
    const trimmed = adminRenameTitle.trim()
    if (!trimmed) { setAdminRenameError("Başlık boş olamaz."); return }
    if (trimmed.length > 60) { setAdminRenameError("Başlık en fazla 60 karakter olabilir."); return }
    setIsAdminRenameSaving(true)
    setAdminRenameError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/topics/${topic.id}/rename`), {
        method: "PATCH",
        body: JSON.stringify({ newTitle: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data === "string" ? data : (data.message ?? "Yeniden adlandırma başarısız"))
      setIsAdminRenameOpen(false)
      setAdminRenameTitle("")
      onTopicChange?.()
    } catch (err) {
      setAdminRenameError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsAdminRenameSaving(false)
    }
  }

  const searchTopicsForMove = useCallback(async (q: string) => {
    if (q.trim().length < 1) { setAdminMoveSearchResults([]); return }
    try {
      const res = await apiFetch(getApiUrl(`api/Topics/search?q=${encodeURIComponent(q)}&limit=8`))
      if (res.ok) {
        const data = await res.json()
        setAdminMoveSearchResults(Array.isArray(data) ? data.filter((t: { id: string; title: string }) => t.id !== topic.id) : [])
      }
    } catch { /* ignore */ }
  }, [topic.id])

  useEffect(() => {
    if (!isAdminMoveOpen) return
    const t = setTimeout(() => searchTopicsForMove(adminMoveSearchQuery), 300)
    return () => clearTimeout(t)
  }, [adminMoveSearchQuery, isAdminMoveOpen, searchTopicsForMove])

  const handleAdminMoveEntries = async () => {
    const targetId = adminMoveTargetId.trim()
    if (!targetId) { setAdminMoveError("Lütfen bir hedef başlık seçin."); return }
    setIsAdminMoving(true)
    setAdminMoveError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/topics/${topic.id}/move-entries-to/${targetId}`), {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data === "string" ? data : (data.message ?? "Taşıma başarısız"))
      setIsAdminMoveOpen(false)
      setAdminMoveTargetId("")
      onBack()
      onTopicChange?.()
    } catch (err) {
      setAdminMoveError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsAdminMoving(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-w-0 w-full max-w-full">
      <div id="topic-top-anchor" aria-hidden="true" />
      {/* Header */}
      <div className="pb-5 border-b border-border mb-6">
        {/* Geri butonu */}
        <div className="flex items-center mb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Başlık – 1. sayfaya Link; metin seçiliyken tıklamada navigasyon yok.
            Slug biliniyorsa SEO rotasına, yoksa eski `/?topic=` yapısına düşer (sunucu redirect eder). */}
        <Link
          href={topicPageHref(mergedTopic, 1)}
          scroll={false}
          className="select-text block w-full min-w-0 max-w-full text-center my-4 px-2 text-inherit no-underline hover:no-underline"
          onPointerDown={(e) => {
            titleLinkPointerStartRef.current = { x: e.clientX, y: e.clientY }
          }}
          onClick={(e) => {
            if (typeof window === "undefined") return
            const start = titleLinkPointerStartRef.current
            titleLinkPointerStartRef.current = null
            if (start) {
              const dx = Math.abs(e.clientX - start.x)
              const dy = Math.abs(e.clientY - start.y)
              if (dx > 5 || dy > 5) {
                e.preventDefault()
                return
              }
            }
            const sel = window.getSelection()?.toString() ?? ""
            if (sel.trim().length > 0) {
              e.preventDefault()
              return
            }
            const urlTopic = searchParams.get("topic")
            const urlPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1)
            const isOnThisTopicBySlug =
              !!mergedTopic.slug && typeof window !== "undefined"
                ? window.location.pathname === `/baslik/${mergedTopic.slug}`
                : false
            const isSameTopic = urlTopic === topic.id || isOnThisTopicBySlug
            if (isSameTopic) {
              e.preventDefault()
              window.scrollTo({ top: 0, behavior: "auto" })
              if (urlPage <= 1) {
                window.location.reload()
              } else {
                window.location.replace(topicPageHref(mergedTopic, 1))
              }
            }
          }}
        >
          <h1 className="select-text w-full min-w-0 max-w-full text-center text-3xl md:text-4xl font-bold tracking-tight text-slate-200 dark:text-slate-300 break-words hyphens-auto whitespace-pre-wrap leading-tight">
            {mergedTopic.title}
          </h1>
        </Link>

        {/* Aksiyon çubuğu: Sol ↔ Sağ */}
        <div className="flex justify-between items-center w-full mt-3 gap-2">
          {/* Sol: Entry sayısı + Takip Et */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              {mergedTopic.entryCount} entry
            </span>
            {isLoggedIn && (
              <Button
                size="sm"
                onClick={handleToggleFollow}
                disabled={isFollowLoading}
                className="h-7 px-2.5 text-xs gap-1.5 bg-[#2c64f6] hover:bg-[#2c64f6]/90 text-white border-0"
              >
                {isFollowed ? (
                  <>
                    <BellOff className="h-3.5 w-3.5" />
                    Takipten Çık
                  </>
                ) : (
                  <>
                    <Bell className="h-3.5 w-3.5" />
                    Takip Et
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Sağ: soldan sağa — Mahlas+Avatar | Tarih | (Admin) | Üç nokta (Paylaş dahil, en sağ) */}
          <div className="flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 min-w-0">
            {(mergedTopic.authorId || mergedTopic.isAnonymous) && (
              <span className="flex items-center gap-1.5 min-w-0 max-w-[320px]">
                {!mergedTopic.isAnonymous &&
                  shouldShowNoviceBadge(mergedTopic.isNovice, mergedTopic.authorRole) && (
                    <NoviceBadge className="shrink-0" />
                  )}
                <span className="shrink-0">
                  {mergedTopic.isAnonymous ? (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                        <User className="h-3 w-3" />
                      </AvatarFallback>
                    </Avatar>
                  ) : mergedTopic.authorAvatar?.startsWith("http") ? (
                    <img
                      src={mergedTopic.authorAvatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-5 w-5 rounded-full object-cover border border-border/60"
                    />
                  ) : mergedTopic.authorAvatar ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/80 text-sm border border-border/60 leading-none">
                      {mergedTopic.authorAvatar}
                    </span>
                  ) : (
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                        {(topicAuthorDisplay.charAt(0) || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </span>
                {mergedTopic.isAnonymous ? (
                  <span className="text-sm font-normal text-foreground max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap inline-block leading-tight">Anonim</span>
                ) : mergedTopic.authorId ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/user/${mergedTopic.authorId}`)}
                    className="min-w-0 max-w-[min(100%,280px)] truncate text-left text-sm font-normal text-foreground hover:underline underline-offset-2 leading-tight"
                  >
                    {topicAuthorDisplay}
                  </button>
                ) : null}
              </span>
            )}

            {topicOpenedLabel && (
              <span className="text-muted-foreground text-sm whitespace-nowrap shrink-0">
                {topicOpenedLabel}
              </span>
            )}

            {/* Admin menüsü — üç noktanın solunda */}
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                    title="Admin Menüsü"
                  >
                    <ShieldAlert className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    God Mode
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setAdminRenameTitle(mergedTopic.title); setAdminRenameError(null); setIsAdminRenameOpen(true) }}
                  >
                    <Pencil className="h-4 w-4" />
                    İsmi Değiştir
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setAdminMoveTargetId(""); setAdminMoveError(null); setIsAdminMoveOpen(true) }}
                  >
                    <FolderOutput className="h-4 w-4" />
                    Entry&apos;leri Taşı
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setIsAdminDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Başlığı Kalıcı Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Başlık seçenekleri"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ShareMenuSub
                  url={`${getSiteUrl()}${topicHref(mergedTopic)}`}
                  title={`${mergedTopic.title} | Tespit Sözlük`}
                />
                <DropdownMenuItem
                  className="cursor-pointer font-normal"
                  onClick={() => setIsReportOpen(true)}
                >
                  <Flag className="h-4 w-4" />
                  Şikayet Et
                </DropdownMenuItem>
                {canManage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        setEditTitle(mergedTopic.title)
                        setEditIsAnonymous(mergedTopic.isAnonymous ?? false)
                        setIsEditOpen(true)
                        setEditError(null)
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                      Düzenle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => { setIsDeleteOpen(true); setDeleteError(null) }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <ReportDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        targetId={topic.id}
        targetType="topic"
      />

      {/* Admin: Başlık Kalıcı Silme */}
      <DangerConfirmModal
        isOpen={isAdminDeleteOpen}
        onClose={() => setIsAdminDeleteOpen(false)}
        onConfirm={handleAdminDeleteTopic}
        title="Başlığı Kalıcı Sil"
        warningText={`"${mergedTopic.title}" başlığı ve altındaki TÜM entry'ler veritabanından kalıcı olarak silinecek.`}
        expectedText={mergedTopic.title}
        confirmLabel="Başlığı ve Entry'leri Sil"
        isLoading={isAdminDeleting}
      />

      {/* Admin: İsim Değiştirme Dialogu */}
      <Dialog open={isAdminRenameOpen} onOpenChange={(o) => { setIsAdminRenameOpen(o); if (!o) setAdminRenameError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Admin: Başlık Adını Değiştir
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={adminRenameTitle}
              onChange={(e) => setAdminRenameTitle(e.target.value.slice(0, 60))}
              placeholder="Yeni başlık adı..."
              maxLength={60}
              autoFocus
            />
            <span className="text-xs text-muted-foreground">{adminRenameTitle.length}/60</span>
            {adminRenameError && <p className="text-sm text-destructive">{adminRenameError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdminRenameOpen(false)}>İptal</Button>
            <Button onClick={handleAdminRenameTopic} disabled={isAdminRenameSaving}>
              {isAdminRenameSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: Entry Taşıma Dialogu */}
      <Dialog open={isAdminMoveOpen} onOpenChange={(o) => {
        setIsAdminMoveOpen(o)
        if (!o) {
          setAdminMoveError(null)
          setAdminMoveSearchQuery("")
          setAdminMoveSearchResults([])
          setAdminMoveTargetId("")
          setAdminMoveSelectedTitle("")
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Admin: Entry&apos;leri Taşı
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>&quot;{mergedTopic.title}&quot;</strong> başlığındaki tüm entry&apos;ler seçilen başlığa taşınacak, bu başlık silinecek.
            </p>
            <div className="space-y-1.5 relative">
              <label className="text-sm font-medium">Hedef Başlık Adı</label>
              {adminMoveSelectedTitle ? (
                <div className="flex items-center gap-2 rounded-md border border-green-500/60 bg-green-500/5 px-3 py-2">
                  <span className="flex-1 text-sm font-medium text-foreground">{adminMoveSelectedTitle}</span>
                  <button
                    type="button"
                    onClick={() => { setAdminMoveTargetId(""); setAdminMoveSelectedTitle(""); setAdminMoveSearchQuery("") }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Değiştir
                  </button>
                </div>
              ) : (
                <>
                  <Input
                    value={adminMoveSearchQuery}
                    onChange={(e) => setAdminMoveSearchQuery(e.target.value)}
                    placeholder="Başlık adı ara..."
                    autoFocus
                  />
                  {adminMoveSearchResults.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-lg overflow-hidden">
                      {adminMoveSearchResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setAdminMoveTargetId(t.id)
                            setAdminMoveSelectedTitle(t.title)
                            setAdminMoveSearchResults([])
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors border-b border-border/50 last:border-0"
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {adminMoveSearchQuery.trim() && adminMoveSearchResults.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1">Eşleşen başlık bulunamadı.</p>
                  )}
                </>
              )}
            </div>
            {adminMoveError && <p className="text-sm text-destructive">{adminMoveError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdminMoveOpen(false)}>İptal</Button>
            <Button
              onClick={handleAdminMoveEntries}
              disabled={isAdminMoving || !adminMoveTargetId.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isAdminMoving ? "Taşınıyor..." : "Taşı ve Sil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Topic Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => {
        setIsEditOpen(open)
        if (!open) {
          setEditError(null)
          // Kapanışta düzenleme alanlarını güncel başlık değerlerine geri sıfırla.
          setEditTitle(mergedTopic.title)
          setEditIsAnonymous(mergedTopic.isAnonymous ?? false)
        }
      }}>
        <DialogContent
          className={cn(
            "w-full max-w-[calc(100%-2rem)] min-w-0 overflow-x-hidden p-5 gap-4",
            FEED_COLUMN_MAX_WIDTH_CLASS
          )}
        >
          <DialogHeader>
            <DialogTitle>Başlığı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="min-w-0 max-w-full space-y-2 overflow-x-hidden">
            <Textarea
              value={editTitle}
              onChange={(e) => setEditTitle(clampTopicTitleRaw(e.target.value))}
              placeholder="Başlık adı..."
              rows={2}
              className="w-full min-w-0 max-w-[30ch] overflow-x-hidden whitespace-pre-wrap break-words hyphens-auto resize-none min-h-10 py-2 text-base md:text-base field-sizing-content"
            />
            <span className="text-xs text-muted-foreground">
              {normalizeTopicTitleForApi(editTitle).length}/{TOPIC_TITLE_MAX_LENGTH}
            </span>
            <div className="pt-2 space-y-1">
              <RadioGroup
                value={editIsAnonymous ? "anonymous" : "account"}
                onValueChange={(v) => setEditIsAnonymous(v === "anonymous")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="account" id={`edit-topic-account-${topic.id}`} />
                  <Label
                    htmlFor={`edit-topic-account-${topic.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    Kendi hesabınla paylaş
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="anonymous" id={`edit-topic-anonymous-${topic.id}`} />
                  <Label
                    htmlFor={`edit-topic-anonymous-${topic.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    Tam anonim paylaş
                  </Label>
                </div>
              </RadioGroup>
              {editIsAnonymous && (
                <p className="text-xs text-muted-foreground">
                  Anonim modda başlığı açan yazar bilgisi gizlenir; başlık üstünde sadece
                  &quot;Anonim&quot; yazar. Altındaki entry&apos;lerin anonimlik durumu bu değişiklikten
                  etkilenmez.
                </p>
              )}
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>İptal</Button>
            <Button onClick={handleEditTopic} disabled={isEditSaving}>
              {isEditSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Topic Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) setDeleteError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu başlık ve altındaki tüm entry&apos;ler kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDeleteTopic() }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Arama ve Sıralama Kontrol Paneli */}
      <div className="flex flex-row items-center gap-3 mb-4 py-3 px-4 rounded-lg bg-muted/40 border border-border/60">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            type="text"
            placeholder="Entry veya yazar ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-9 h-9 bg-background"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v)}>
          <SelectTrigger className="w-[200px] shrink-0" size="default">
            <SelectValue placeholder="Sıralama" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="oldest">İlk Girilen</SelectItem>
            <SelectItem value="newest">Son Girilen</SelectItem>
            <SelectItem value="most_liked">En çok kalp alan</SelectItem>
            <SelectItem value="most_disliked">En çok ayak alan</SelectItem>
            <SelectItem value="most_saved">En çok çivilenen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Entries */}
      <div ref={entriesContainerRef} className="flex-1 overflow-auto">
        <div className="space-y-4 pb-6">
          {entriesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
          ) : entries.length > 0 ? (
            entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                showTopicTitle={false}
                searchTerm={search.trim() || undefined}
                isLoggedIn={isLoggedIn}
                onLoginClick={onLoginClick}
                currentUser={currentUser ? { id: currentUser.id, role: currentUser.role } : null}
                onEntryChange={onTopicChange}
              />
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Bu başlıkta henüz entry yok. İlk entry&apos;yi sen yaz!
            </div>
          )}
        </div>
        {/* Scroll hedefi: yeni entry gönderiminden sonra buraya scrollIntoView yapılır */}
        <div id="bottom-of-entries" />

        {/* Classic Pagination */}
        {!entriesLoading && totalPages > 1 && (
          <div className="pt-6 border-t border-border">
            <nav className="flex items-center justify-center gap-2 flex-wrap" aria-label="Sayfa navigasyonu">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Önceki
              </Button>
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <Button
                    key={p}
                    variant={p === page ? "outline" : "ghost"}
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => handlePageChange(p)}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                className="gap-1"
              >
                Sonraki
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        )}
      </div>

      {/* Entry Form */}
      <div className="pt-4 border-t border-border">
        <EntryForm
          topicId={topic.id}
          onSubmit={onSubmitEntry}
          isLoggedIn={isLoggedIn}
          onLoginClick={onLoginClick}
        />
      </div>
    </div>
  )
}
