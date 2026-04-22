"use client"

import { useState, useEffect, useLayoutEffect, useCallback } from "react"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Lock, FileText, Pencil, Trash2, Send, Plus, User, UserPlus, UserMinus, CalendarDays, Heart, Save, PencilLine, ShieldX, CheckCircle2, Clock, AlertTriangle, RotateCcw, Flag, Trash, BadgeCheck, Mail, ShieldAlert, MessageCircle, FileEdit, Share2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { Navbar } from "@/components/navbar"
import { TopicSidebar } from "@/components/topic-sidebar"
import { CreateTopicModal } from "@/components/create-topic-modal"
import { EntryCard } from "@/components/entry-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { CreateDraftModal } from "@/components/create-draft-modal"
import { AvatarDialog } from "@/components/avatar-dialog"
import { EditDraftModal } from "@/components/edit-draft-modal"
import { FollowListModal } from "@/components/follow-list-modal"
import { AyakIcon } from "@/components/icons/AyakIcon"
import { CiviIcon } from "@/components/icons/CiviIcon"
import { getApiUrl, apiFetch, getSiteUrl } from "@/lib/api"
import { ENTRY_BODY_RENDERER_CLASSNAME } from "@/lib/entry-body-renderer-classes"
import { getAuth, clearAuth, updateAuthUser, type AuthData } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { formatTurkeyDateTime } from "@/lib/turkey-datetime"
import { ShareMenuItems } from "@/components/share-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DangerConfirmModal } from "@/components/admin/danger-confirm-modal"
import { ReportDialog } from "@/components/report-dialog"
import { HtmlRenderer } from "@/components/html-renderer"
import { ExpandableHtmlContent } from "@/components/expandable-html-content"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const TURKISH_MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

function formatMemberSince(dateStr: string) {
  try {
    const d = new Date(dateStr)
    const month = TURKISH_MONTHS[d.getMonth()]
    const year = d.getFullYear()
    return `${month} ${year}'den beri yazar`
  } catch {
    return ""
  }
}

type UserProfile = {
  id: string
  nickname: string
  avatar?: string | null
  bio?: string | null
  createdAt?: string
  totalEntryCount: number
  totalUpvotesReceived?: number
  totalDownvotesReceived?: number
  totalSavesReceived?: number
  email?: string | null
  followerCount?: number
  followingCount?: number
  isFollowedByCurrentUser?: boolean
  writtenEntriesCount?: number
  savedEntriesCount?: number
  likedEntriesCount?: number
  draftsCount?: number
}

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
  isAnonymous?: boolean
  canManage?: boolean
  validBkzs?: Record<string, string> | null
  saveCount?: number
  isSavedByCurrentUser?: boolean
}

type ApiDraft = {
  id: string
  content: string
  topicId?: string | null
  topicTitle?: string | null
  newTopicTitle?: string | null
  isAnonymous?: boolean
  createdAt: string
  updatedAt: string
}

type Report = {
  id: string
  reason: string
  details?: string | null
  isResolved: boolean
  createdAt: string
  reporter: { id: string; username: string; email: string }
  reportedEntry?: {
    id: string
    content: string
    createdAt: string
    upvotes: number
    downvotes: number
    topicId: string
    topicTitle: string
    authorId: string
    authorName: string
    authorAvatar?: string | null
    authorRole?: string
    isAnonymous: boolean
  } | null
  reportedTopic?: {
    id: string
    title: string
    authorId?: string | null
    authorName?: string | null
    authorAvatar?: string | null
    authorRole?: string
    entryCount?: number
  } | null
  reportedUser?: {
    id: string
    username: string
    avatar?: string | null
    authorRole?: string
  } | null
}

function normalizeProfileTabFromQuery(
  raw: string | null,
  isOwnProfile: boolean,
): string {
  const t = (raw && raw.trim()) || "entries"
  if (t === "entries" || t === "liked") return t
  if (isOwnProfile && (t === "saved" || t === "drafts")) return t
  return "entries"
}

/** entry-card ile aynı: `updatedAt > createdAt` ise Edit satırı. */
function getDraftDateLines(createdAt: string, updatedAt: string) {
  const createdLine = formatTurkeyDateTime(createdAt)
  const createdMs = new Date(createdAt).getTime()
  const updatedMs = new Date(updatedAt).getTime()
  const showEdit =
    !Number.isNaN(updatedMs) && !Number.isNaN(createdMs) && updatedMs > createdMs
  return {
    createdLine,
    editLine: showEdit ? formatTurkeyDateTime(updatedAt) : "",
  }
}

function mapEntry(e: ApiEntry) {
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
    isAnonymous: e.isAnonymous ?? false,
    canManage: e.canManage ?? false,
    validBkzs: e.validBkzs ?? null,
    saveCount: e.saveCount ?? 0,
    isSavedByCurrentUser: e.isSavedByCurrentUser ?? false,
  }
}

export default function UserProfilePage() {
  const params = useParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const id = typeof params.id === "string" ? params.id : params.id?.[0]

  const [user, setUser] = useState<UserProfile | null>(null)
  const [entries, setEntries] = useState<ReturnType<typeof mapEntry>[]>([])
  const [drafts, setDrafts] = useState<ApiDraft[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [hasPreviousPage, setHasPreviousPage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [draftsLoading, setDraftsLoading] = useState(false)
  const [draftsPage, setDraftsPage] = useState(1)
  const [draftsTotalPages, setDraftsTotalPages] = useState(1)
  const [auth, setAuth] = useState<AuthData | null>(null)
  const isOwnProfile = !!auth?.user?.id && id === auth.user.id
  const [createDraftOpen, setCreateDraftOpen] = useState(false)
  const [editDraftOpen, setEditDraftOpen] = useState(false)
  const [editingDraft, setEditingDraft] = useState<ApiDraft | null>(null)
  const [includeAnonymous, setIncludeAnonymous] = useState(false)
  const [deleteDraftId, setDeleteDraftId] = useState<string | null>(null)
  const [publishDraftId, setPublishDraftId] = useState<string | null>(null)
  const [savedEntries, setSavedEntries] = useState<ReturnType<typeof mapEntry>[]>([])
  const [savedPage, setSavedPage] = useState(1)
  const [savedTotalPages, setSavedTotalPages] = useState(1)
  const [savedHasNextPage, setSavedHasNextPage] = useState(false)
  const [savedHasPreviousPage, setSavedHasPreviousPage] = useState(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [likedEntries, setLikedEntries] = useState<ReturnType<typeof mapEntry>[]>([])
  const [likedPage, setLikedPage] = useState(1)
  const [likedTotalPages, setLikedTotalPages] = useState(1)
  const [likedHasNextPage, setLikedHasNextPage] = useState(false)
  const [likedHasPreviousPage, setLikedHasPreviousPage] = useState(false)
  const [likedLoading, setLikedLoading] = useState(false)
  const [entriesSortBy, setEntriesSortBy] = useState<string>("newest")
  const [followersModalOpen, setFollowersModalOpen] = useState(false)
  const [followingModalOpen, setFollowingModalOpen] = useState(false)
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [profileReportOpen, setProfileReportOpen] = useState(false)
  const [bioEditing, setBioEditing] = useState(false)
  const [bioDraft, setBioDraft] = useState("")
  const [bioSaving, setBioSaving] = useState(false)
  // Admin state
  const [isAdminBanOpen, setIsAdminBanOpen] = useState(false)
  const [isAdminBanning, setIsAdminBanning] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [unresolvedReportsCount, setUnresolvedReportsCount] = useState(0)
  // Report card admin actions
  const [reportActionDeleteEntry, setReportActionDeleteEntry] = useState<{ entryId: string } | null>(null)
  const [reportActionDeleteTopic, setReportActionDeleteTopic] = useState<{ topicId: string; topicTitle: string } | null>(null)
  const [reportActionRenameTopic, setReportActionRenameTopic] = useState<{ topicId: string; currentTitle: string } | null>(null)
  const [renameTopicNewTitle, setRenameTopicNewTitle] = useState("")
  const [renameTopicSaving, setRenameTopicSaving] = useState(false)
  const [renameTopicError, setRenameTopicError] = useState<string | null>(null)
  // Admin: e-posta erişimi, ilahi ferman & doğrudan mesaj
  const [viewedUserEmail, setViewedUserEmail] = useState<string | null>(null)
  const [sendMessageOpen, setSendMessageOpen] = useState(false)
  const [sendMessageText, setSendMessageText] = useState("")
  const [sendMessageSending, setSendMessageSending] = useState(false)
  const [warnUserOpen, setWarnUserOpen] = useState(false)
  const [warnTargetUserId, setWarnTargetUserId] = useState<string | null>(null)
  const [warnEntryId, setWarnEntryId] = useState<string | null>(null)
  const [warnTopicId, setWarnTopicId] = useState<string | null>(null)
  const [warnMessage, setWarnMessage] = useState("")
  const [warnSending, setWarnSending] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showCreateTopicModal, setShowCreateTopicModal] = useState(false)
  const [topicSidebarRefresh, setTopicSidebarRefresh] = useState(0)
  const profileTabQuery = searchParams.get("tab")
  const [profileTab, setProfileTab] = useState(() =>
    normalizeProfileTabFromQuery(profileTabQuery, false),
  )

  useLayoutEffect(() => {
    setProfileTab(
      normalizeProfileTabFromQuery(profileTabQuery, isOwnProfile),
    )
  }, [isOwnProfile, profileTabQuery])

  const handleProfileTabChange = useCallback(
    (newTab: string) => {
      setProfileTab(newTab)
      const base = pathname || ""
      if (
        newTab === "entries" ||
        newTab === "liked" ||
        newTab === "saved" ||
        newTab === "drafts"
      ) {
        router.replace(`${base}?tab=${newTab}`, { scroll: false })
      } else if (newTab === "reports") {
        router.replace(base, { scroll: false })
      }
    },
    [pathname, router],
  )

  /** Aynı içerik sekmesine tekrar tıklanınca: sadece sayfa > 1 ise 1'e dön; aksi halde no-op (tam yenileme yok). */
  const handleProfileContentTabTriggerClick = useCallback(
    (tab: "entries" | "liked" | "saved" | "drafts") => {
      if (profileTab !== tab) return
      if (tab === "entries" && page > 1) setPage(1)
      else if (tab === "liked" && likedPage > 1) setLikedPage(1)
      else if (tab === "saved" && savedPage > 1) setSavedPage(1)
      else if (tab === "drafts" && draftsPage > 1) setDraftsPage(1)
    },
    [profileTab, page, likedPage, savedPage, draftsPage],
  )

  const fetchUser = useCallback(async (userId: string) => {
    try {
      const res = await apiFetch(getApiUrl(`api/Users/${userId}`))
      if (!res.ok) {
        if (res.status === 404) return null
        throw new Error("Profil yüklenemedi")
      }
      const data = await res.json()
      return {
        id: String(data.id),
        nickname: data.nickname ?? "Anonim",
        avatar: data.avatar ?? null,
        bio: data.bio ?? null,
        createdAt: data.createdAt ?? null,
        totalEntryCount: data.totalEntryCount ?? 0,
        totalUpvotesReceived: data.totalUpvotesReceived ?? 0,
        totalDownvotesReceived: data.totalDownvotesReceived ?? 0,
        totalSavesReceived: data.totalSavesReceived ?? 0,
        email: data.email ?? null,
        followerCount: data.followerCount ?? 0,
        followingCount: data.followingCount ?? 0,
        isFollowedByCurrentUser: data.isFollowedByCurrentUser ?? false,
        writtenEntriesCount: data.writtenEntriesCount ?? 0,
        savedEntriesCount: data.savedEntriesCount ?? 0,
        likedEntriesCount: data.likedEntriesCount ?? 0,
        draftsCount: data.draftsCount ?? 0,
      }
    } catch {
      return null
    }
  }, [])

  const fetchEntries = useCallback(async (userId: string, p: number, inclAnonymous: boolean, sort: string) => {
    setEntriesLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: "20", sortBy: sort })
      if (inclAnonymous) params.set("includeAnonymous", "true")
      const res = await apiFetch(
        getApiUrl(`api/Users/${userId}/entries?${params}`)
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

  const fetchDrafts = useCallback(async () => {
    setDraftsLoading(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Drafts?page=${draftsPage}`))
      if (!res.ok) throw new Error("Taslaklar yüklenemedi")
      const data = await res.json()
      const pageSize = typeof data.pageSize === "number" ? data.pageSize : 25
      const totalCount = typeof data.totalCount === "number" ? data.totalCount : 0
      const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
      if (draftsPage > totalPages && totalCount > 0) {
        setDraftsPage(totalPages)
        return
      }
      const rawItems = Array.isArray(data.items) ? data.items : []
      setDrafts(rawItems as ApiDraft[])
      setDraftsTotalPages(totalPages)
    } catch {
      setDrafts([])
      setDraftsTotalPages(1)
    } finally {
      setDraftsLoading(false)
    }
  }, [draftsPage])

  const fetchLikedEntries = useCallback(async (userId: string, p: number) => {
    setLikedLoading(true)
    try {
      const res = await apiFetch(
        getApiUrl(`api/Users/${userId}/liked-entries?page=${p}&pageSize=20`)
      )
      if (!res.ok) throw new Error("Kalplenenler yüklenemedi")
      const data = await res.json()
      const items = (data.items ?? []).map(mapEntry)
      setLikedEntries(items)
      setLikedTotalPages(data.totalPages ?? 1)
      setLikedHasNextPage(data.hasNextPage ?? false)
      setLikedHasPreviousPage(data.hasPreviousPage ?? false)
    } catch {
      setLikedEntries([])
    } finally {
      setLikedLoading(false)
    }
  }, [])

  const fetchSavedEntries = useCallback(async (userId: string, p: number) => {
    setSavedLoading(true)
    try {
      const res = await apiFetch(
        getApiUrl(`api/Users/${userId}/saved-entries?page=${p}&pageSize=20`)
      )
      if (!res.ok) throw new Error("Çivilenenler yüklenemedi")
      const data = await res.json()
      const items = (data.items ?? []).map(mapEntry)
      setSavedEntries(items)
      setSavedTotalPages(data.totalPages ?? 1)
      setSavedHasNextPage(data.hasNextPage ?? false)
      setSavedHasPreviousPage(data.hasPreviousPage ?? false)
    } catch {
      setSavedEntries([])
    } finally {
      setSavedLoading(false)
    }
  }, [])

  useEffect(() => {
    setAuth(getAuth())
  }, [])

  useEffect(() => {
    const currentAuth = getAuth()
    if (currentAuth?.user?.role === "Admin" && currentAuth?.token) {
      apiFetch(getApiUrl("api/Admin/reports/unread-count"))
        .then((r) => r.ok ? r.json() : 0)
        .then((n) => setUnresolvedReportsCount(typeof n === "number" ? n : 0))
        .catch(() => setUnresolvedReportsCount(0))
    }
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
    fetchEntries(id, page, includeAnonymous, entriesSortBy)
  }, [id, user, page, includeAnonymous, entriesSortBy, fetchEntries])

  useEffect(() => {
    if (isOwnProfile && auth?.token) fetchDrafts()
  }, [isOwnProfile, auth?.token, fetchDrafts])

  useEffect(() => {
    if (id) fetchLikedEntries(id, likedPage)
  }, [id, likedPage, fetchLikedEntries])

  useEffect(() => {
    if (isOwnProfile && id && auth?.token) fetchSavedEntries(id, savedPage)
  }, [isOwnProfile, id, auth?.token, savedPage, fetchSavedEntries])

  const handleTopicClick = useCallback((topicId: string) => {
    router.push(`/?topic=${topicId}`)
  }, [router])

  const refreshDraftsAndEntries = useCallback(() => {
    if (isOwnProfile && auth?.token) fetchDrafts()
    if (id) fetchEntries(id, page, includeAnonymous, entriesSortBy)
    if (id) fetchLikedEntries(id, likedPage)
    if (isOwnProfile && id) fetchSavedEntries(id, savedPage)
    if (id) fetchUser(id).then((u) => u && setUser(u))
  }, [isOwnProfile, auth?.token, id, page, savedPage, likedPage, includeAnonymous, entriesSortBy, fetchDrafts, fetchEntries, fetchLikedEntries, fetchSavedEntries, fetchUser])

  const handleSaveBio = useCallback(async () => {
    if (!auth?.token || bioSaving) return
    const trimmed = bioDraft.trim()
    if (trimmed.length > 500) {
      alert("Bio en fazla 500 karakter olabilir.")
      return
    }
    setBioSaving(true)
    try {
      const res = await apiFetch(getApiUrl("api/Users/bio"), {
        method: "PUT",
        body: JSON.stringify({ bio: trimmed || null }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data?.message ?? "Bio kaydedilemedi.")
        return
      }
      const data = await res.json()
      setUser((prev) => (prev ? { ...prev, bio: data.bio ?? null } : null))
      setBioEditing(false)
      setBioDraft("")
    } catch {
      alert("Bio kaydedilemedi.")
    } finally {
      setBioSaving(false)
    }
  }, [auth?.token, bioDraft, bioSaving])

  const handleToggleFollow = useCallback(async () => {
    if (!id || !auth?.token || followLoading) return
    setFollowLoading(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Users/${id}/follow`), {
        method: "POST",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data?.message ?? "Bir hata oluştu.")
        return
      }
      const isFollowing = data?.isFollowing ?? false
      setUser((prev) =>
        prev
          ? {
              ...prev,
              isFollowedByCurrentUser: isFollowing,
              followerCount: (prev.followerCount ?? 0) + (isFollowing ? 1 : -1),
            }
          : null
      )
    } catch {
      alert("Takip işlemi başarısız oldu.")
    } finally {
      setFollowLoading(false)
    }
  }, [id, auth?.token, followLoading])

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const res = await apiFetch(getApiUrl(`api/Drafts/${draftId}`), {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Silinemedi")
      setDeleteDraftId(null)
      refreshDraftsAndEntries()
    } catch {
      setDeleteDraftId(null)
    }
  }

  const handlePublishDraft = async (draftId: string) => {
    try {
      const draftRow = drafts.find((d) => d.id === draftId)
      const publishBody =
        draftRow != null && typeof draftRow.isAnonymous === "boolean"
          ? { isAnonymous: draftRow.isAnonymous }
          : {}
      const res = await apiFetch(getApiUrl(`api/Drafts/${draftId}/publish`), {
        method: "POST",
        body: JSON.stringify(publishBody),
      })
      if (!res.ok) throw new Error("Yayınlanamadı")
      const data = await res.json()
      setPublishDraftId(null)
      refreshDraftsAndEntries()
      if (data.topicId) router.push(`/?topic=${data.topicId}`)
      if (data.message) alert(data.message)
    } catch {
      setPublishDraftId(null)
    }
  }

  const currentUserRole = auth?.user?.role
  const isAdmin = currentUserRole === "Admin"

  // Admin: görüntülenen kullanıcının e-postasını çek
  useEffect(() => {
    if (!id || !isAdmin || isOwnProfile) {
      setViewedUserEmail(null)
      return
    }
    apiFetch(getApiUrl(`api/Admin/users/${id}/email`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.email) setViewedUserEmail(data.email) })
      .catch(() => setViewedUserEmail(null))
  }, [id, isAdmin, isOwnProfile])

  const handleSendAdminMessage = async () => {
    if (!id || sendMessageSending || !sendMessageText.trim()) return
    setSendMessageSending(true)
    try {
      const res = await apiFetch(getApiUrl("api/Admin/send-message"), {
        method: "POST",
        body: JSON.stringify({ targetUserId: id, message: sendMessageText.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data === "string" ? data : (data?.message ?? "Mesaj gönderilemedi."))
      }
      setSendMessageOpen(false)
      setSendMessageText("")
      toast.success("Mesaj gönderildi.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bir hata oluştu.")
    } finally {
      setSendMessageSending(false)
    }
  }

  const handleWarnUser = async () => {
    if (!warnTargetUserId || warnSending || !warnMessage.trim()) return
    setWarnSending(true)
    try {
      const body: Record<string, unknown> = {
        targetUserId: warnTargetUserId,
        customMessage: warnMessage.trim(),
      }
      if (warnEntryId) body.entryId = warnEntryId
      if (warnTopicId) body.topicId = warnTopicId
      const res = await apiFetch(getApiUrl("api/Admin/warn-user"), {
        method: "POST",
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data === "string" ? data : (data?.message ?? "Uyarı gönderilemedi."))
      }
      setWarnUserOpen(false)
      setWarnMessage("")
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setWarnSending(false)
    }
  }

  const handleAdminBanUser = async () => {
    if (!id) return
    setIsAdminBanning(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/users/${id}`), {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data === "string" ? data : (data.message ?? "Kullanıcı silinemedi"))
      }
      setIsAdminBanOpen(false)
      router.push("/")
    } finally {
      setIsAdminBanning(false)
    }
  }

  const fetchReports = async () => {
    if (reportsLoading) return
    setReportsLoading(true)
    try {
      const res = await apiFetch(getApiUrl("api/Admin/reports?pageSize=100"))
      if (!res.ok) throw new Error("Şikayetler yüklenemedi")
      const data = await res.json()
      const loaded = Array.isArray(data.reports) ? data.reports : []
      setReports(loaded)
      setUnresolvedReportsCount(loaded.filter((r: Report) => !r.isResolved).length)
      setReportsLoaded(true)
    } catch {
      setReports([])
    } finally {
      setReportsLoading(false)
    }
  }

  const handleResolveReport = async (reportId: string) => {
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/reports/${reportId}/resolve`), {
        method: "PATCH",
      })
      if (!res.ok) throw new Error("İşaretlenemedi")
      const data = await res.json().catch(() => ({}))
      setReports((prev) => {
        const updated = prev.map((r) => r.id === reportId ? { ...r, isResolved: data.isResolved ?? !r.isResolved } : r)
        setUnresolvedReportsCount(updated.filter((r) => !r.isResolved).length)
        return updated
      })
    } catch { /* silent */ }
  }

  const handleReportDeleteEntry = async (entryId: string) => {
    const res = await apiFetch(getApiUrl(`api/Admin/entries/${entryId}`), {
      method: "DELETE",
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(typeof d === "string" ? d : (d.message ?? "Silinemedi"))
    }
    setReportActionDeleteEntry(null)
    setReports((prev) => prev.map((r) =>
      r.reportedEntry?.id === entryId ? { ...r, reportedEntry: null } : r
    ))
  }

  const handleReportDeleteTopic = async (topicId: string) => {
    const res = await apiFetch(getApiUrl(`api/Admin/topics/${topicId}`), {
      method: "DELETE",
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(typeof d === "string" ? d : (d.message ?? "Silinemedi"))
    }
    setReportActionDeleteTopic(null)
    setReports((prev) => prev.map((r) =>
      r.reportedTopic?.id === topicId ? { ...r, reportedTopic: null } : r
    ).map((r) =>
      r.reportedEntry?.topicId === topicId ? { ...r, reportedEntry: null } : r
    ))
  }

  const handleReportRenameTopic = async () => {
    if (!reportActionRenameTopic) return
    const trimmed = renameTopicNewTitle.trim()
    if (!trimmed) { setRenameTopicError("Boş olamaz."); return }
    setRenameTopicSaving(true)
    setRenameTopicError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Admin/topics/${reportActionRenameTopic.topicId}/rename`), {
        method: "PATCH",
        body: JSON.stringify({ newTitle: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data === "string" ? data : (data.message ?? "Başarısız"))
      const newTitle = data.newTitle ?? trimmed
      setReports((prev) => prev.map((r) => ({
        ...r,
        reportedEntry: r.reportedEntry?.topicId === reportActionRenameTopic.topicId
          ? { ...r.reportedEntry, topicTitle: newTitle }
          : r.reportedEntry,
        reportedTopic: r.reportedTopic?.id === reportActionRenameTopic.topicId
          ? { ...r.reportedTopic, title: newTitle }
          : r.reportedTopic,
      })))
      setReportActionRenameTopic(null)
      setRenameTopicNewTitle("")
    } catch (err) {
      setRenameTopicError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setRenameTopicSaving(false)
    }
  }

  const handleCreateTopicFromSidebar = useCallback(
    async (title: string, firstEntry: string, isAnonymous: boolean = false): Promise<string | null> => {
      const tokenAuth = getAuth()
      if (!tokenAuth?.token) return null
      const createTopicRes = await apiFetch(getApiUrl("api/Topics"), {
        method: "POST",
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
      setIsMobileMenuOpen(false)
      setTopicSidebarRefresh((t) => t + 1)
      router.push(`/?topic=${topicId}`)
      return topicId
    },
    [router],
  )

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
        user={auth?.user ? { name: auth.user.nickname ?? auth.user.name, email: auth.user.email, avatar: auth.user.avatar, hasChangedUsername: auth.user.hasChangedUsername, role: auth.user.role } : undefined}
        onLoginClick={() => router.push("/?login=1")}
        onRegisterClick={() => router.push("/?register=1")}
        onLogout={() => { clearAuth(); window.location.href = "/" }}
        onProfileClick={() => auth?.user?.id && router.push(`/user/${auth.user.id}`)}
        onMenuClick={() => setIsMobileMenuOpen((open) => !open)}
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
          const updated = updateAuthUser(updates)
          if (updated) {
            setAuth(getAuth())
            setUser((prev) => prev ? { ...prev, nickname: updated.nickname ?? prev.nickname, avatar: updated.avatar ?? prev.avatar } : null)
          }
        }}
      />

      <TopicSidebar
        selectedTopicId={undefined}
        onTopicSelect={(topicId) => {
          router.push(`/?topic=${topicId}`)
          setIsMobileMenuOpen(false)
        }}
        onCreateTopic={() => setShowCreateTopicModal(true)}
        onAllTopicsClick={() => {
          setIsMobileMenuOpen(false)
          router.push("/?topics=1")
        }}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        refreshTrigger={topicSidebarRefresh}
        accentColor="#2c64f6"
        mobileOnly
      />

      <main className="pt-[6.5rem] md:pt-14">
        {/* Header / Cover */}
        <div className="border-b border-border bg-card">
          <div className="w-full max-w-2xl mx-auto px-4 py-8 md:py-12 lg:max-w-[786px] lg:px-6">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Ana Sayfa
              </Button>
            </Link>
            <div className="flex justify-start mb-3">
              {isOwnProfile ? (
                <button
                  type="button"
                  onClick={() => setAvatarDialogOpen(true)}
                  className="relative group flex h-16 w-16 rounded-full overflow-hidden border-2 border-border shadow-sm transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {user.avatar ? (
                    user.avatar.startsWith("http") ? (
                      <img
                        src={user.avatar}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-16 w-16 object-cover"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/80 text-4xl w-full">
                        {user.avatar}
                      </span>
                    )
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <PencilLine className="h-8 w-8" />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <PencilLine className="h-7 w-7 text-white" />
                  </span>
                </button>
              ) : (
                user.avatar ? (
                  user.avatar.startsWith("http") ? (
                    <img
                      src={user.avatar}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 rounded-full object-cover border-2 border-border shadow-sm"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary/80 text-4xl border-2 border-border shadow-sm">
                      {user.avatar}
                    </span>
                  )
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground border-2 border-border shadow-sm">
                    <User className="h-8 w-8" />
                  </span>
                )
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {user.nickname}
            </h1>
            {isAdmin && !isOwnProfile && viewedUserEmail && (
              <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
                <Mail className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Admin Görünümü:</span>
                <span className="text-foreground font-medium">{viewedUserEmail}</span>
              </div>
            )}
            {user.createdAt && (
              <p className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {formatMemberSince(user.createdAt)}
              </p>
            )}
            <div className="grid grid-cols-3 gap-3 mt-4 max-w-sm">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <Heart className="h-5 w-5 text-rose-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground tracking-tight">Toplam Kalp</p>
                  <p className="text-lg font-semibold text-foreground">{user.totalUpvotesReceived ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <AyakIcon className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground tracking-tight">Toplam Ayak</p>
                  <p className="text-lg font-semibold text-foreground">{user.totalDownvotesReceived ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-4 py-3">
                <CiviIcon className="h-5 w-5 text-purple-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground tracking-tight">Toplam Çivileme</p>
                  <p className="text-lg font-semibold text-foreground">{user.totalSavesReceived ?? 0}</p>
                </div>
              </div>
            </div>
            {((user.bio && user.bio.trim()) || isOwnProfile) && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">Yazıt</h3>
                {bioEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value.slice(0, 500))}
                      placeholder="Kendinden bahset..."
                      className="w-full min-h-[100px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      maxLength={500}
                      autoFocus
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {bioDraft.length}/500
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBioEditing(false)
                            setBioDraft(user.bio ?? "")
                          }}
                          disabled={bioSaving}
                        >
                          İptal
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveBio}
                          disabled={bioSaving}
                          className="gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" />
                          {bioSaving ? "Kaydediliyor..." : "Kaydet"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : user.bio && user.bio.trim() ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{user.bio}</p>
                ) : isOwnProfile ? (
                  <button
                    type="button"
                    onClick={() => {
                      setBioDraft("")
                      setBioEditing(true)
                    }}
                    className="text-left w-full rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/40 transition-colors"
                  >
                    Kendinden bahsetmek ister misin? (Maksimum 500 karakter)
                  </button>
                ) : null}
                {isOwnProfile && user.bio && user.bio.trim() && !bioEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 -ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setBioDraft(user.bio ?? "")
                      setBioEditing(true)
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Düzenle
                  </Button>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => setFollowersModalOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="font-medium">Takipçi:</span>
                <span>{user.followerCount ?? 0}</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowingModalOpen(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <span className="font-medium">Takip Edilen:</span>
                <span>{user.followingCount ?? 0}</span>
              </button>
              {!isOwnProfile && isLoggedIn && (
                <Button
                  size="sm"
                  variant={user.isFollowedByCurrentUser ? "outline" : "default"}
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className="gap-1.5"
                >
                  {user.isFollowedByCurrentUser ? (
                    <>
                      <UserMinus className="h-4 w-4" />
                      Takipten Çık
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Takip Et
                    </>
                  )}
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Profili paylaş"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[100] min-w-[8rem]">
                  <ShareMenuItems
                    url={`${getSiteUrl()}/user/${user.id}`}
                    title={`Tespit Sözlük'te ${user.nickname} profilini incele`}
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {!isOwnProfile && isLoggedIn && (
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Şikayet et"
                        onClick={() => setProfileReportOpen(true)}
                      >
                        <Flag className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Şikayet Et</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {isAdmin && !isOwnProfile && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSendMessageOpen(true)}
                    className="gap-1.5 border-blue-500/50 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500"
                  >
                    <MessageCircle className="h-4 w-4" />
                    İletişime Geç
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsAdminBanOpen(true)}
                    className="gap-1.5 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <ShieldX className="h-4 w-4" />
                    Kullanıcıyı Uçur
                  </Button>
                </>
              )}
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

        {/* Tabs: Yazılan Entryler / Kalplenenler / Çivilenenler / Taslaklar */}
        <div className="w-full max-w-2xl mx-auto px-4 py-6 lg:max-w-[786px] lg:px-6">
          <Tabs value={profileTab} onValueChange={handleProfileTabChange} className="w-full">
            <div className="-mx-4 px-4 lg:-mx-6 lg:px-6 mb-8 overflow-x-auto scrollbar-hide">
              <TabsList
                className="flex w-max min-w-full flex-nowrap justify-start bg-transparent p-0 h-auto rounded-none border-b-2 border-border gap-0"
              >
              {/* ─── Yazılan Entryler ─── */}
              <TabsTrigger
                value="entries"
                onClick={() => handleProfileContentTabTriggerClick("entries")}
                className="group relative flex items-center gap-2.5 px-5 py-[15px] rounded-none border-b-[3px] border-transparent -mb-px bg-transparent flex-none flex-shrink-0 text-muted-foreground font-semibold text-sm hover:text-foreground hover:bg-muted/25 data-[state=active]:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-0"
              >
                <PencilLine className="h-[18px] w-[18px] shrink-0 transition-all duration-200 group-data-[state=active]:scale-110" />
                <span className="tracking-tight">Yazılan Entryler</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-muted/70 text-muted-foreground group-data-[state=active]:bg-foreground group-data-[state=active]:text-background transition-all duration-200">
                  {user.writtenEntriesCount ?? 0}
                </span>
              </TabsTrigger>

              {/* ─── Kalplenenler ─── */}
              <TabsTrigger
                value="liked"
                onClick={() => handleProfileContentTabTriggerClick("liked")}
                className="group relative flex items-center gap-2.5 px-5 py-[15px] rounded-none border-b-[3px] border-transparent -mb-px bg-transparent flex-none flex-shrink-0 text-muted-foreground font-semibold text-sm hover:text-rose-500 hover:bg-rose-500/5 data-[state=active]:text-rose-500 data-[state=active]:border-rose-500 data-[state=active]:bg-transparent transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-0"
              >
                <Heart className="h-[18px] w-[18px] shrink-0 transition-all duration-200 group-data-[state=active]:fill-rose-500/20 group-data-[state=active]:scale-110" />
                <span className="tracking-tight">Kalplenenler</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-muted/70 text-muted-foreground group-data-[state=active]:bg-rose-500 group-data-[state=active]:text-white transition-all duration-200">
                  {user.likedEntriesCount ?? 0}
                </span>
              </TabsTrigger>

              {isOwnProfile && (
                <>
                  {/* ─── Çivilenenler ─── */}
                  <TabsTrigger
                    value="saved"
                    onClick={() => handleProfileContentTabTriggerClick("saved")}
                    className="group relative flex items-center gap-2.5 px-5 py-[15px] rounded-none border-b-[3px] border-transparent -mb-px bg-transparent flex-none flex-shrink-0 text-muted-foreground font-semibold text-sm hover:text-purple-400 hover:bg-purple-500/5 data-[state=active]:text-purple-500 data-[state=active]:border-purple-500 data-[state=active]:bg-transparent transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-0"
                  >
                    <CiviIcon className="h-[18px] w-[18px] shrink-0 text-inherit transition-all duration-200 group-data-[state=active]:scale-110" />
                    <span className="tracking-tight">Çivilenenler</span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-muted/70 text-muted-foreground group-data-[state=active]:bg-purple-500 group-data-[state=active]:text-white transition-all duration-200">
                      {user.savedEntriesCount ?? 0}
                    </span>
                  </TabsTrigger>

                  {/* ─── Taslaklar ─── */}
                  <TabsTrigger
                    value="drafts"
                    onClick={() => handleProfileContentTabTriggerClick("drafts")}
                    className="group relative flex items-center gap-2.5 px-5 py-[15px] rounded-none border-b-[3px] border-transparent -mb-px bg-transparent flex-none flex-shrink-0 text-muted-foreground font-semibold text-sm hover:text-amber-500 hover:bg-amber-500/5 data-[state=active]:text-amber-500 data-[state=active]:border-amber-500 data-[state=active]:bg-transparent transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-0"
                  >
                    <FileEdit className="h-[18px] w-[18px] shrink-0 transition-all duration-200 group-data-[state=active]:scale-110" />
                    <span className="tracking-tight">Taslaklar</span>
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-muted/70 text-muted-foreground group-data-[state=active]:bg-amber-500 group-data-[state=active]:text-white transition-all duration-200">
                      {user.draftsCount ?? 0}
                    </span>
                  </TabsTrigger>

                  {/* ─── Şikayetler (Admin) ─── */}
                  {isAdmin && (
                    <TabsTrigger
                      value="reports"
                      onClick={() => { if (!reportsLoaded) fetchReports() }}
                      className="group relative flex items-center gap-2.5 px-5 py-[15px] rounded-none border-b-[3px] border-transparent -mb-px bg-transparent flex-none flex-shrink-0 text-muted-foreground font-semibold text-sm hover:text-destructive hover:bg-destructive/5 data-[state=active]:text-destructive data-[state=active]:border-destructive data-[state=active]:bg-transparent transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-0"
                    >
                      <Flag className="h-[18px] w-[18px] shrink-0 transition-all duration-200 group-data-[state=active]:scale-110" />
                      <span className="tracking-tight">Şikayetler</span>
                      {unresolvedReportsCount > 0 ? (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-red-600 text-white animate-pulse">
                          {unresolvedReportsCount > 99 ? "99+" : unresolvedReportsCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold bg-muted/70 text-muted-foreground group-data-[state=active]:bg-destructive group-data-[state=active]:text-white transition-all duration-200">
                          0
                        </span>
                      )}
                    </TabsTrigger>
                  )}
                </>
              )}
            </TabsList>
            </div>

            <TabsContent value="entries">
              <div className="mb-4">
                <h2 className="text-base md:text-lg font-extrabold text-foreground uppercase tracking-tight">
                  {isOwnProfile ? "ENTRYLERİNİZ" : "ENTRYLER"}
                </h2>
              </div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Select value={entriesSortBy} onValueChange={(v) => { setEntriesSortBy(v); setPage(1) }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sırala" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">En yeni</SelectItem>
                    <SelectItem value="oldest">En eski</SelectItem>
                    <SelectItem value="most_liked">En çok kalp alan</SelectItem>
                    <SelectItem value="most_disliked">En çok ayak alan</SelectItem>
                    <SelectItem value="most_saved">En çok çivilenen</SelectItem>
                  </SelectContent>
                </Select>
                {isOwnProfile && (
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Switch
                              id="include-anonymous"
                              checked={includeAnonymous}
                              onCheckedChange={setIncludeAnonymous}
                              className="data-[state=checked]:bg-foreground"
                            />
                            <Label
                              htmlFor="include-anonymous"
                              className="text-sm font-medium cursor-pointer"
                            >
                              Senin Anonim
                            </Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          Anonim entryleri göster
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}
                {includeAnonymous && isOwnProfile && (
                  <p className="text-xs text-muted-foreground">
                    Anonim entryleri diğer kullanıcılar göremez.
                  </p>
                )}
              </div>
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
                      currentUser={auth?.user ? { id: auth.user.id } : null}
                      onEntryChange={() => {
                        setEntries((prev) => prev.filter((e) => e.id !== entry.id))
                        if (id) fetchUser(id).then((u) => u && setUser(u))
                      }}
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
            </TabsContent>

            <TabsContent value="liked">
              <div className="mb-4">
                <h2 className="text-base md:text-lg font-extrabold text-foreground uppercase tracking-tight">
                  {isOwnProfile ? "KALPLENENLERİNİZ" : "KALPLENENLER"}
                </h2>
                {isOwnProfile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Kalplenenlerinizi herkes görebilir.
                  </p>
                )}
              </div>
              {likedLoading ? (
                <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
              ) : likedEntries.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  Henüz kalplenen entry yok.
                </div>
              ) : (
                <div className="space-y-4">
                  {likedEntries.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      showTopicTitle={true}
                      onTopicClick={handleTopicClick}
                      isLoggedIn={isLoggedIn}
                      onLoginClick={() => router.push("/?login=1")}
                      currentUser={auth?.user ? { id: auth.user.id } : null}
                      onEntryChange={() => setLikedEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                    />
                  ))}
                </div>
              )}
              {(likedHasPreviousPage || likedHasNextPage) && (
                <div className="flex items-center justify-center gap-3 mt-8 pb-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!likedHasPreviousPage}
                    onClick={() => setLikedPage((p) => Math.max(1, p - 1))}
                  >
                    Önceki Sayfa
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Sayfa {likedPage} / {likedTotalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!likedHasNextPage}
                    onClick={() => setLikedPage((p) => p + 1)}
                  >
                    Sonraki Sayfa
                  </Button>
                </div>
              )}
            </TabsContent>

            {isOwnProfile && (
              <TabsContent value="saved">
                <div className="mb-4">
                  <h2 className="text-base md:text-lg font-extrabold text-foreground uppercase tracking-tight">
                    ÇİVİLENENLERİNİZ
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Çivilenenlerinizi diğer kullanıcılar göremez.
                  </p>
                </div>
                {savedLoading ? (
                  <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
                ) : savedEntries.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Henüz çivilenmiş entry yok.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {savedEntries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        showTopicTitle={true}
                        onTopicClick={handleTopicClick}
                        isLoggedIn={isLoggedIn}
                        onLoginClick={() => router.push("/?login=1")}
                        currentUser={auth?.user ? { id: auth.user.id } : null}
                        onEntryChange={() => setSavedEntries((prev) => prev.filter((e) => e.id !== entry.id))}
                      />
                    ))}
                  </div>
                )}
                {(savedHasPreviousPage || savedHasNextPage) && (
                  <div className="flex items-center justify-center gap-3 mt-8 pb-8">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!savedHasPreviousPage}
                      onClick={() => setSavedPage((p) => Math.max(1, p - 1))}
                    >
                      Önceki Sayfa
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Sayfa {savedPage} / {savedTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!savedHasNextPage}
                      onClick={() => setSavedPage((p) => p + 1)}
                    >
                      Sonraki Sayfa
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}

            {isOwnProfile && (
              <TabsContent value="drafts">
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base md:text-lg font-extrabold text-foreground uppercase tracking-tight">
                      TASLAKLARINIZ
                    </h2>
                    <Button
                      size="sm"
                      onClick={() => setCreateDraftOpen(true)}
                      className="gap-1.5 shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      Yeni Taslak Oluştur
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Taslaklarınızı diğer kullanıcılar göremez.
                  </p>
                </div>

                {draftsLoading ? (
                  <div className="py-12 text-center text-muted-foreground">Yükleniyor...</div>
                ) : drafts.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      Henüz taslak yok. Yeni taslak oluşturmak için butona tıklayın.
                    </div>
                  ) : (
                  <>
                    <div className="space-y-4 min-w-0 w-full max-w-full">
                      {drafts.map((draft) => {
                        const { createdLine, editLine } = getDraftDateLines(
                          draft.createdAt,
                          draft.updatedAt,
                        )
                        return (
                        <article
                          key={draft.id}
                          className={cn(
                            "group relative bg-card border border-border border-l-2 border-l-[#2c64f6] rounded-lg p-5 min-w-0 w-full max-w-full transition-all duration-200 hover:bg-[#2a2b2e]"
                          )}
                          style={{ backgroundColor: "#252728" }}
                        >
                          <span className="absolute top-2 right-2 z-10 rounded bg-blue-500 px-2 py-1 text-xs text-white">
                            Taslak
                          </span>
                          <div className="mb-4 min-w-0 w-full max-w-full pr-20">
                            <span className="block w-full min-w-0 max-w-full whitespace-pre-wrap break-words text-left text-xl font-bold leading-[1.35] tracking-[-0.01em] text-slate-200 dark:text-slate-300">
                              {draft.topicTitle ?? draft.newTopicTitle ?? "Başlıksız"}
                            </span>
                          </div>
                          <div className="entry-content mb-4 min-w-0 w-full max-w-full">
                            <ExpandableHtmlContent
                              html={draft.content || ""}
                              rendererClassName={ENTRY_BODY_RENDERER_CLASSNAME}
                            />
                          </div>
                          <div className="mb-3 flex min-w-0 w-full max-w-full flex-col gap-0.5">
                            <span className="text-[#7c8190] text-[13px] leading-tight tabular-nums">
                              {createdLine}
                            </span>
                            {editLine !== "" && (
                              <span className="text-[#7c8190] text-[13px] italic leading-tight break-words max-w-[min(100%,14rem)] sm:max-w-none">
                                Edit: {editLine}
                              </span>
                            )}
                          </div>
                          <div className="relative z-10 flex min-w-0 w-full flex-wrap items-center gap-2 border-t border-border/50 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => {
                                setEditingDraft(draft)
                                setEditDraftOpen(true)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Düzenle
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1 bg-foreground text-background hover:bg-foreground/90"
                              onClick={() => setPublishDraftId(draft.id)}
                            >
                              <Send className="h-3.5 w-3.5" />
                              Yayınla
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-destructive hover:text-destructive"
                              onClick={() => setDeleteDraftId(draft.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Sil
                            </Button>
                          </div>
                          {draft.isAnonymous === true && (
                            <span
                              className="pointer-events-none absolute bottom-3 right-4 z-0 max-w-[45%] text-right text-sm italic text-muted-foreground opacity-70 select-none"
                              aria-label="Tam anonim taslak"
                            >
                              Tam Anonim
                            </span>
                          )}
                        </article>
                        )
                      })}
                    </div>
                    {(draftsPage > 1 || draftsPage < draftsTotalPages) && (
                      <div className="flex items-center justify-center gap-3 mt-8 pb-8">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={draftsPage <= 1}
                          onClick={() => setDraftsPage((p) => Math.max(1, p - 1))}
                        >
                          Önceki Sayfa
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Sayfa {draftsPage} / {draftsTotalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={draftsPage >= draftsTotalPages}
                          onClick={() => setDraftsPage((p) => p + 1)}
                        >
                          Sonraki Sayfa
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            )}
            {isOwnProfile && isAdmin && (
              <TabsContent value="reports">
                {/* Başlık + Yenile */}
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/10 border border-destructive/20">
                      <Flag className="h-3.5 w-3.5 text-destructive" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-foreground">Şikayet Kokpiti</h2>
                      <p className="text-xs text-muted-foreground">{reports.filter(r => !r.isResolved).length} bekliyor · {reports.length} toplam</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={fetchReports} disabled={reportsLoading} className="text-xs gap-1.5">
                    {reportsLoading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <RotateCcw className="h-3.5 w-3.5" />}
                    Yenile
                  </Button>
                </div>

                {reportsLoading && !reportsLoaded ? (
                  <div className="py-16 text-center text-muted-foreground">Yükleniyor...</div>
                ) : reports.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground">Şikayet bulunamadı.</div>
                ) : (
                  <div className="space-y-4">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className={`rounded-xl border-2 overflow-hidden transition-all ${
                          report.isResolved
                            ? "border-border/30 opacity-55"
                            : "border-orange-500/40 shadow-sm shadow-orange-500/5"
                        }`}
                      >
                        {/* ── ÜST: Şikayet bilgisi ── */}
                        <div className={`flex items-start justify-between gap-3 px-4 py-3 ${report.isResolved ? "bg-muted/10" : "bg-orange-500/5"}`}>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Durum badge */}
                              {report.isResolved ? (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 font-semibold">
                                  <CheckCircle2 className="h-3 w-3" /> Çözüldü
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                                  <Clock className="h-3 w-3" /> Bekliyor
                                </span>
                              )}
                              {/* Sebep */}
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 font-semibold">
                                <AlertTriangle className="h-3 w-3" /> {report.reason}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Şikayet eden:{" "}
                              <button onClick={() => router.push(`/user/${report.reporter.id}`)} className="font-medium text-foreground hover:underline">
                                {report.reporter.username}
                              </button>
                              {report.details && <span className="ml-2 italic text-muted-foreground/70">&ldquo;{report.details}&rdquo;</span>}
                              <span className="ml-2 text-muted-foreground/50">· {new Date(report.createdAt).toLocaleString("tr-TR")}</span>
                            </p>
                          </div>
                          {/* Toggle butonu */}
                          <button
                            onClick={() => handleResolveReport(report.id)}
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                              report.isResolved
                                ? "border-border bg-muted text-muted-foreground hover:bg-muted/70"
                                : "border-green-500/40 bg-green-500/5 text-green-600 dark:text-green-400 hover:bg-green-500/15"
                            }`}
                          >
                            {report.isResolved
                              ? <><RotateCcw className="h-3.5 w-3.5" /> Geri Al</>
                              : <><CheckCircle2 className="h-3.5 w-3.5" /> Çözüldü</>
                            }
                          </button>
                        </div>

                        {/* ── ORTA: Şikayet Edilen İçerik ── */}
                        {report.reportedEntry ? (
                          /* ── ENTRY KARTI ── */
                          <div className="border-t border-border/50 bg-card">
                            <div className="px-4 pt-3 pb-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Flag className="h-3 w-3" /> Şikayet Edilen Entry
                              </p>
                            </div>
                            <div className="px-4 pb-3">
                              {/* Başlık (büyük/kalın) */}
                              <button
                                onClick={() => router.push(`/?topic=${report.reportedEntry!.topicId}`)}
                                className="text-[#dde1e8] text-[17px] font-bold leading-[1.35] tracking-[-0.01em] hover:underline underline-offset-2 text-left mb-2 block"
                              >
                                {report.reportedEntry.topicTitle}
                              </button>
                              {/* Entry içeriği */}
                              <div className="entry-content entry-text line-clamp-5 [&_*]:max-w-full mb-3">
                                <HtmlRenderer
                                  html={report.reportedEntry.content}
                                  className="max-w-none [&_p]:!text-[15px] [&_p]:!leading-[1.85] [&_p]:!tracking-[0.013em] [&_p]:!font-normal [&_p]:!text-[#c2c6cf] [&_li]:!text-[15px] [&_li]:!leading-[1.85] [&_li]:!tracking-[0.013em] [&_li]:!font-normal [&_li]:!text-[#c2c6cf] [&_blockquote]:!text-[15px] [&_blockquote]:!leading-[1.85] [&_blockquote]:!tracking-[0.013em] [&_blockquote]:!font-normal [&_blockquote]:!text-[#c2c6cf]"
                                />
                              </div>
                              {/* Footer: yazar + tarih (sol), kalp/ayak/çivi (sağ) */}
                              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                                <div className="flex items-center gap-1.5 text-[13px] text-[#7c8190]">
                                  {report.reportedEntry.isAnonymous ? (
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                    </span>
                                  ) : report.reportedEntry.authorAvatar?.startsWith("http") ? (
                                    <img
                                      src={report.reportedEntry.authorAvatar}
                                      alt=""
                                      referrerPolicy="no-referrer"
                                      className="h-5 w-5 shrink-0 rounded-full object-cover border border-border/60"
                                    />
                                  ) : (
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60 text-[10px] font-medium">
                                      {report.reportedEntry.isAnonymous ? "?" : report.reportedEntry.authorName?.[0]?.toUpperCase() ?? "?"}
                                    </span>
                                  )}
                                  {report.reportedEntry.isAnonymous ? (
                                    <span>Anonim</span>
                                  ) : (
                                    <button
                                      onClick={() => router.push(`/user/${report.reportedEntry!.authorId}`)}
                                      className="text-[#7c8190] hover:text-[#c2c6cf] hover:underline flex items-center gap-0.5"
                                    >
                                      {report.reportedEntry.authorName}
                                      {report.reportedEntry.authorRole === "Admin" && (
                                        <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
                                      )}
                                    </button>
                                  )}
                                  <span className="text-[#7c8190]/45">·</span>
                                  <span>{new Date(report.reportedEntry.createdAt).toLocaleDateString("tr-TR")}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[13px] text-[#7c8190]">
                                  <span className="flex items-center gap-1">
                                    <Heart className="h-3 w-3 text-rose-400" />
                                    {report.reportedEntry.upvotes ?? 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {/* ENTRY için aksiyon butonları */}
                            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/5">
                              <button
                                onClick={() => setReportActionDeleteEntry({ entryId: report.reportedEntry!.id })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15 transition-colors"
                              >
                                <Trash className="h-3.5 w-3.5" /> Entry&apos;yi Sil
                              </button>
                              {!report.reportedEntry!.isAnonymous && report.reportedEntry!.authorId && (
                                <button
                                  onClick={() => {
                                    setWarnTargetUserId(report.reportedEntry!.authorId)
                                    setWarnEntryId(report.reportedEntry!.id)
                                    setWarnTopicId(null)
                                    setWarnMessage("")
                                    setWarnUserOpen(true)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/15 transition-colors"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" /> Kullanıcıyı Uyar
                                </button>
                              )}
                            </div>
                          </div>
                        ) : report.reportedTopic ? (
                          /* ── BAŞLIK KARTI ── */
                          <div className="border-t border-border/50 bg-card">
                            <div className="px-4 pt-3 pb-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Flag className="h-3 w-3" /> Şikayet Edilen Başlık
                              </p>
                            </div>
                            <div className="px-4 pb-3">
                              <button
                                onClick={() => router.push(`/?topic=${report.reportedTopic!.id}`)}
                                className="text-base font-bold text-foreground hover:underline underline-offset-2 text-left block mb-2"
                              >
                                {report.reportedTopic.title}
                              </button>
                              {report.reportedTopic.entryCount !== undefined && (
                                <p className="text-xs text-muted-foreground mb-2">
                                  {report.reportedTopic.entryCount} entry
                                </p>
                              )}
                              {/* Başlık açan kişi */}
                              {report.reportedTopic.authorId && (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                                  {report.reportedTopic.authorAvatar?.startsWith("http") ? (
                                    <img
                                      src={report.reportedTopic.authorAvatar}
                                      alt=""
                                      referrerPolicy="no-referrer"
                                      className="h-5 w-5 shrink-0 rounded-full object-cover border border-border/60"
                                    />
                                  ) : (
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60 text-[10px] font-medium">
                                      {report.reportedTopic.authorName?.[0]?.toUpperCase() ?? "?"}
                                    </span>
                                  )}
                                  <span>Açan:</span>
                                  <button
                                    onClick={() => router.push(`/user/${report.reportedTopic!.authorId}`)}
                                    className="font-medium text-foreground hover:underline flex items-center gap-0.5"
                                  >
                                    {report.reportedTopic.authorName ?? "Bilinmiyor"}
                                    {report.reportedTopic.authorRole === "Admin" && (
                                      <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            {/* BAŞLIK için aksiyon butonları */}
                            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/5">
                              <button
                                onClick={() => setReportActionDeleteTopic({ topicId: report.reportedTopic!.id, topicTitle: report.reportedTopic!.title })}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-destructive/40 text-destructive bg-destructive/5 hover:bg-destructive/15 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Başlığı Sil
                              </button>
                              <button
                                onClick={() => {
                                  setReportActionRenameTopic({ topicId: report.reportedTopic!.id, currentTitle: report.reportedTopic!.title })
                                  setRenameTopicNewTitle(report.reportedTopic!.title)
                                  setRenameTopicError(null)
                                }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" /> İsmi Değiştir
                              </button>
                              {report.reportedTopic!.authorId && report.reportedTopic!.authorRole !== "Admin" && (
                                <button
                                  onClick={() => {
                                    setWarnTargetUserId(report.reportedTopic!.authorId!)
                                    setWarnTopicId(report.reportedTopic!.id)
                                    setWarnEntryId(null)
                                    setWarnMessage("")
                                    setWarnUserOpen(true)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/15 transition-colors"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" /> Kullanıcıyı Uyar
                                </button>
                              )}
                            </div>
                          </div>
                        ) : report.reportedUser ? (
                          <div className="border-t border-border/50 bg-card">
                            <div className="px-4 pt-3 pb-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <Flag className="h-3 w-3" /> Şikayet Edilen Kullanıcı
                              </p>
                            </div>
                            <div className="px-4 pb-3">
                              <div className="flex items-center gap-2 mt-1">
                                {report.reportedUser.avatar?.startsWith("http") ? (
                                  <img
                                    src={report.reportedUser.avatar}
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    className="h-8 w-8 shrink-0 rounded-full object-cover border border-border/60"
                                  />
                                ) : (
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted border border-border/60 text-sm font-medium">
                                    {report.reportedUser.username?.[0]?.toUpperCase() ?? "?"}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/user/${report.reportedUser!.id}`)}
                                    className="text-base font-bold text-foreground hover:underline underline-offset-2 text-left flex items-center gap-0.5"
                                  >
                                    {report.reportedUser.username}
                                    {report.reportedUser.authorRole === "Admin" && (
                                      <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/5">
                              {report.reportedUser.authorRole !== "Admin" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setWarnTargetUserId(report.reportedUser!.id)
                                    setWarnEntryId(null)
                                    setWarnTopicId(null)
                                    setWarnMessage("")
                                    setWarnUserOpen(true)
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/15 transition-colors"
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" /> Kullanıcıyı Uyar
                                </button>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Per-report action modals */}
                <DangerConfirmModal
                  isOpen={!!reportActionDeleteEntry}
                  onClose={() => setReportActionDeleteEntry(null)}
                  onConfirm={() => handleReportDeleteEntry(reportActionDeleteEntry!.entryId)}
                  title="Entry'yi Kalıcı Sil"
                  warningText="Bu entry veritabanından kalıcı olarak silinecek."
                  expectedText="sil"
                  confirmLabel="Entry'yi Sil"
                />
                <DangerConfirmModal
                  isOpen={!!reportActionDeleteTopic}
                  onClose={() => setReportActionDeleteTopic(null)}
                  onConfirm={() => handleReportDeleteTopic(reportActionDeleteTopic!.topicId)}
                  title={`"${reportActionDeleteTopic?.topicTitle}" Başlığını Sil`}
                  warningText="Bu başlık ve altındaki TÜM entry'ler kalıcı olarak silinecek."
                  expectedText={reportActionDeleteTopic?.topicTitle ?? ""}
                  confirmLabel="Başlığı ve Entry'leri Sil"
                />
                <Dialog
                  open={!!reportActionRenameTopic}
                  onOpenChange={(o) => { if (!o) { setReportActionRenameTopic(null); setRenameTopicError(null) } }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4" />
                        Başlık İsmini Değiştir
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Input
                        value={renameTopicNewTitle}
                        onChange={(e) => setRenameTopicNewTitle(e.target.value.slice(0, 60))}
                        placeholder="Yeni başlık adı..."
                        maxLength={60}
                        autoFocus
                      />
                      <span className="text-xs text-muted-foreground">{renameTopicNewTitle.length}/60</span>
                      {renameTopicError && <p className="text-sm text-destructive">{renameTopicError}</p>}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setReportActionRenameTopic(null)}>İptal</Button>
                      <Button onClick={handleReportRenameTopic} disabled={renameTopicSaving}>
                        {renameTopicSaving ? "Kaydediliyor..." : "Kaydet"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>

      {/* Admin: İletişime Geç — Kullanıcıya Mesaj Gönder */}
      <Dialog
        open={sendMessageOpen}
        onOpenChange={(o) => {
          if (!o) {
            setSendMessageOpen(false)
            setSendMessageText("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <MessageCircle className="h-4 w-4 text-blue-500" />
              </span>
              İletişime Geç: {user?.nickname}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2.5">
              <MessageCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bu kullanıcıya mavi bilgilendirme mesajı olarak iletilecek. Resmi uyarı değil, bilgilendirme amaçlıdır.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mesajınız</label>
              <textarea
                value={sendMessageText}
                onChange={(e) => setSendMessageText(e.target.value.slice(0, 1000))}
                placeholder="Kullanıcıya iletmek istediğiniz mesajı yazın..."
                className="w-full min-h-[110px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                maxLength={1000}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">{sendMessageText.length}/1000</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setSendMessageOpen(false); setSendMessageText("") }}
              disabled={sendMessageSending}
            >
              İptal
            </Button>
            <Button
              onClick={handleSendAdminMessage}
              disabled={sendMessageSending || !sendMessageText.trim()}
              className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              {sendMessageSending ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Gönder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: İlahi Ferman — Kullanıcıyı Uyar Modalı */}
      <Dialog
        open={warnUserOpen}
        onOpenChange={(o) => {
          if (!o) {
            setWarnUserOpen(false)
            setWarnMessage("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <ShieldAlert className="h-4 w-4 text-yellow-500" />
              </span>
              İlahi Ferman: Kullanıcıyı Uyar
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Bu kullanıcıya resmi bir uyarı bildirimi gönderilecek. Bildirim, ilgili içeriğin bağlantısını ve yazdığınız mesajı içerecek.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Uyarı Mesajı</label>
              <textarea
                value={warnMessage}
                onChange={(e) => setWarnMessage(e.target.value.slice(0, 1000))}
                placeholder="Çok fazla argo kullanıyorsunuz, lütfen kurallara uyun aksi takdirde hesabınız silinecektir."
                className="w-full min-h-[110px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
                maxLength={1000}
                autoFocus
              />
              <span className="text-xs text-muted-foreground">{warnMessage.length}/1000</span>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setWarnUserOpen(false); setWarnMessage("") }}
              disabled={warnSending}
            >
              İptal
            </Button>
            <Button
              onClick={handleWarnUser}
              disabled={warnSending || !warnMessage.trim()}
              className="gap-1.5 bg-yellow-500 hover:bg-yellow-600 text-white border-0"
            >
              {warnSending ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Gönderiliyor...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Fermanı Gönder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin: Kullanıcıyı Uçur Modalı */}
      <DangerConfirmModal
        isOpen={isAdminBanOpen}
        onClose={() => setIsAdminBanOpen(false)}
        onConfirm={handleAdminBanUser}
        title={`"${user?.nickname ?? ""}" Kullanıcısını Sil`}
        warningText={`Bu kullanıcının tüm entry'leri, oyları, takipleri ve kişisel verileri kalıcı olarak silinecek. Yalnızca başka yazarların entry'si olan başlıklar anonim olarak korunacak.`}
        expectedText={user?.nickname ?? ""}
        confirmLabel="Kullanıcıyı Kalıcı Sil"
        isLoading={isAdminBanning}
      />

      <CreateDraftModal
        open={createDraftOpen}
        onOpenChange={setCreateDraftOpen}
        onSuccess={refreshDraftsAndEntries}
      />
      <EditDraftModal
        open={editDraftOpen}
        onOpenChange={setEditDraftOpen}
        draft={editingDraft}
        onSuccess={refreshDraftsAndEntries}
      />
      <AlertDialog open={!!deleteDraftId} onOpenChange={(o) => !o && setDeleteDraftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taslağı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              Bu taslak kalıcı olarak silinecek. Emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (deleteDraftId) handleDeleteDraft(deleteDraftId)
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!publishDraftId} onOpenChange={(o) => !o && setPublishDraftId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taslağı Yayınla</AlertDialogTitle>
            <AlertDialogDescription>
              Bu taslak gerçek bir entry olarak yayınlanacak. Devam etmek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                if (publishDraftId) handlePublishDraft(publishDraftId)
              }}
            >
              Yayınla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isOwnProfile && (
        <AvatarDialog
          open={avatarDialogOpen}
          onOpenChange={setAvatarDialogOpen}
          currentAvatar={user.avatar}
          onAvatarUpdate={(avatar) => {
            setUser((prev) => (prev ? { ...prev, avatar: avatar ?? null } : null))
            const updated = updateAuthUser({ avatar: avatar ?? null })
            if (updated) setAuth(getAuth())
          }}
        />
      )}
      {id && (
        <>
          <FollowListModal
            open={followersModalOpen}
            onOpenChange={setFollowersModalOpen}
            userId={id}
            mode="followers"
          />
          <FollowListModal
            open={followingModalOpen}
            onOpenChange={setFollowingModalOpen}
            userId={id}
            mode="following"
          />
        </>
      )}
      <CreateTopicModal
        isOpen={showCreateTopicModal}
        onClose={() => setShowCreateTopicModal(false)}
        onCreate={handleCreateTopicFromSidebar}
        isLoggedIn={isLoggedIn}
        onLoginClick={() => {
          setShowCreateTopicModal(false)
          router.push("/?login=1")
        }}
      />
      {user && id && !isOwnProfile && isLoggedIn && (
        <ReportDialog
          open={profileReportOpen}
          onOpenChange={setProfileReportOpen}
          targetId={user.id}
          targetType="user"
        />
      )}
    </div>
  )
}
