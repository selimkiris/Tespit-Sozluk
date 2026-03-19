"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight, Bell, BellOff, Search, Flag, ShieldAlert, FolderOutput } from "lucide-react"
import { ShareMenu } from "@/components/share-menu"
import { getSiteUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { EntryCard } from "@/components/entry-card"
import { EntryForm } from "@/components/entry-form"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { ReportDialog } from "@/components/report-dialog"
import { DangerConfirmModal } from "@/components/admin/danger-confirm-modal"
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu"

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
}

interface Topic {
  id: string
  title: string
  entryCount: number
  authorId?: string
  isFollowedByCurrentUser?: boolean
}

interface TopicDetailProps {
  topic: Topic
  isLoggedIn: boolean
  currentUser?: { id: string; role?: string } | null
  onBack: () => void
  onSubmitEntry: (content: string, isAnonymous: boolean) => void
  onLoginClick: () => void
  onVoteSuccess?: () => void
  onTopicChange?: () => void
  refreshTrigger?: number
}

function mapApiEntry(e: { id: string; topicId: string; topicTitle: string; content: string; authorId: string; authorName: string; authorAvatar?: string | null; authorRole?: string; createdAt: string; updatedAt?: string | null; upvotes: number; downvotes: number; userVoteType?: number; validBkzs?: Record<string, string> | null; isAnonymous?: boolean; canManage?: boolean; saveCount?: number; isSavedByCurrentUser?: boolean }) {
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

export function TopicDetail({
  topic,
  isLoggedIn,
  currentUser,
  onBack,
  onSubmitEntry,
  onLoginClick,
  onVoteSuccess,
  onTopicChange,
  refreshTrigger = 0,
}: TopicDetailProps) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [entriesLoading, setEntriesLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [sortBy, setSortBy] = useState<string>("oldest")
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(topic.title)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isFollowed, setIsFollowed] = useState(topic.isFollowedByCurrentUser ?? false)
  const [isFollowLoading, setIsFollowLoading] = useState(false)
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
  const router = useRouter()

  useEffect(() => {
    setIsFollowed(topic.isFollowedByCurrentUser ?? false)
  }, [topic.id, topic.isFollowedByCurrentUser])

  const fetchTopicFollowStatus = useCallback(async () => {
    if (!isLoggedIn) return
    try {
      const res = await fetch(getApiUrl(`api/Topics/${topic.id}`), { headers: getAuthHeaders() })
      if (res.ok) {
        const data = await res.json()
        setIsFollowed(data?.isFollowedByCurrentUser ?? false)
      }
    } catch {
      // ignore
    }
  }, [topic.id, isLoggedIn])

  useEffect(() => {
    if (topic.isFollowedByCurrentUser !== undefined) {
      setIsFollowed(topic.isFollowedByCurrentUser)
    } else if (isLoggedIn) {
      fetchTopicFollowStatus()
    }
  }, [topic.id, topic.isFollowedByCurrentUser, isLoggedIn, fetchTopicFollowStatus])

  const handleToggleFollow = useCallback(async () => {
    if (!isLoggedIn || isFollowLoading) return
    setIsFollowLoading(true)
    try {
      const res = await fetch(getApiUrl(`api/Topics/${topic.id}/follow`), {
        method: "POST",
        headers: getAuthHeaders(),
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
      params.set("pageSize", "10")
      params.set("sortBy", sortBy)
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(getApiUrl(`api/Topics/${topic.id}/entries?${params.toString()}`), {
        headers: getAuthHeaders(),
      })
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
  useEffect(() => {
    setPage(1)
    searchSortJustChanged.current = true
  }, [topic.id, search, sortBy])

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

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") setSearch(searchInput.trim())
  }

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return
    setPage(newPage)
    entriesContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const canManage =
    !!currentUser &&
    topic.authorId &&
    currentUser.id === topic.authorId &&
    entries.every((e) => e.author.id === currentUser.id)

  useEffect(() => {
    setEditTitle(topic.title)
  }, [topic.id, topic.title])

  const handleEditTopic = async () => {
    const trimmed = editTitle.trim()
    if (!trimmed) {
      setEditError("Başlık boş olamaz.")
      return
    }
    setIsEditSaving(true)
    setEditError(null)
    const url = getApiUrl(`api/Topics/${topic.id}`)
    const body = JSON.stringify({ title: trimmed })
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: getAuthHeaders(),
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
      const res = await fetch(getApiUrl(`api/Topics/${topic.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
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
      const res = await fetch(getApiUrl(`api/Admin/topics/${topic.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
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
    if (trimmed.length > 54) { setAdminRenameError("Başlık 54 karakteri geçemez."); return }
    setIsAdminRenameSaving(true)
    setAdminRenameError(null)
    try {
      const res = await fetch(getApiUrl(`api/Admin/topics/${topic.id}/rename`), {
        method: "PATCH",
        headers: getAuthHeaders(),
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
      const res = await fetch(getApiUrl(`api/Topics/search?q=${encodeURIComponent(q)}&limit=8`), {
        headers: getAuthHeaders(),
      })
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
      const res = await fetch(getApiUrl(`api/Admin/topics/${topic.id}/move-entries-to/${targetId}`), {
        method: "POST",
        headers: getAuthHeaders(),
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-border mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => {
                router.push(`/?topic=${topic.id}&page=1`)
                setPage(1)
                entriesContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              className="text-xl font-semibold text-foreground break-all hyphens-auto whitespace-pre-wrap min-w-0 hover:underline underline-offset-2 text-left"
            >
              {topic.title}
            </button>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => { setIsEditOpen(true); setEditError(null) }}>
                    <Pencil className="h-4 w-4" />
                    Düzenle
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => { setIsDeleteOpen(true); setDeleteError(null) }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
                    onClick={() => { setAdminRenameTitle(topic.title); setAdminRenameError(null); setIsAdminRenameOpen(true) }}
                  >
                    <Pencil className="h-4 w-4" />
                    İsmi Değiştir
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setAdminMoveTargetId(""); setAdminMoveError(null); setIsAdminMoveOpen(true) }}
                  >
                    <FolderOutput className="h-4 w-4" />
                    Entry'leri Taşı
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
          </div>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">{topic.entryCount} entry</p>
            <ShareMenu
              url={`${getSiteUrl()}/?topic=${topic.id}`}
              title={`${topic.title} | Tespit Sözlük`}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsReportOpen(true)}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Şikayet et"
            >
              <Flag className="h-4 w-4" />
            </Button>
            {isLoggedIn && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleFollow}
                disabled={isFollowLoading}
                className="h-7 px-2.5 text-xs gap-1.5"
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
        warningText={`"${topic.title}" başlığı ve altındaki TÜM entry'ler veritabanından kalıcı olarak silinecek.`}
        expectedText={topic.title}
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
              onChange={(e) => setAdminRenameTitle(e.target.value.slice(0, 54))}
              placeholder="Yeni başlık adı..."
              maxLength={54}
              autoFocus
            />
            <span className="text-xs text-muted-foreground">{adminRenameTitle.length}/54</span>
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
              <strong>&quot;{topic.title}&quot;</strong> başlığındaki tüm entry&apos;ler seçilen başlığa taşınacak, bu başlık silinecek.
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
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başlığı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value.slice(0, 54))}
              placeholder="Başlık adı..."
              maxLength={54}
            />
            <span className="text-xs text-muted-foreground">{editTitle.length}/54</span>
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
            <SelectItem value="most_liked">En Çok Beğenilen</SelectItem>
            <SelectItem value="most_disliked">En Çok Beğenilmeyen</SelectItem>
            <SelectItem value="most_saved">En Çok Kaydedilen</SelectItem>
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
                onVoteSuccess={onVoteSuccess}
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
