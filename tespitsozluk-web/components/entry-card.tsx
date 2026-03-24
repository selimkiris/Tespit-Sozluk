"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import Link from "next/link"
import { Heart, MoreHorizontal, Pencil, Trash2, User, Users, Flag, ShieldX, BadgeCheck } from "lucide-react"
import { ShareMenu } from "@/components/share-menu"
import { getSiteUrl } from "@/lib/api"
import { CiviIcon } from "@/components/icons/CiviIcon"
import { AyakIcon } from "@/components/icons/AyakIcon"
import { cn } from "@/lib/utils"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RichTextEditor } from "@/components/rich-text-editor"
import { ExpandableHtmlContent } from "@/components/expandable-html-content"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ReportDialog } from "@/components/report-dialog"
import { DangerConfirmModal } from "@/components/admin/danger-confirm-modal"
import { EntryLikersModal } from "@/components/entry-likers-modal"
import { ENTRY_BODY_RENDERER_CLASSNAME } from "@/lib/entry-body-renderer-classes"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"

interface Entry {
  id: string
  topicId: string
  topicTitle: string
  content: string
  author: {
    id: string
    nickname: string
    avatar?: string | null
    role?: string
  }
  date: string
  updatedAt?: string | null
  upvotes: number
  downvotes: number
  userVote?: "up" | "down" | null
  /** Backend-validated (bkz:) - sadece DB'de var olan başlıklar. Key: Topic Title, Value: Topic Id */
  validBkzs?: Record<string, string> | null
  isAnonymous?: boolean
  canManage?: boolean
  saveCount?: number
  isSavedByCurrentUser?: boolean
}

interface EntryCardProps {
  entry: Entry
  showTopicTitle?: boolean
  /** Arama vurgusu için - doluysa content ve yazar adında eşleşen kelimeler vurgulanır */
  searchTerm?: string
  /** Aktif sekmeye göre sol kenar çizgisi rengi */
  activeTab?: "recent" | "discover" | "following"
  onTopicClick?: (topicId: string) => void
  isLoggedIn?: boolean
  onLoginClick?: () => void
  onVoteSuccess?: () => void
  currentUser?: { id: string; role?: string } | null
  onEntryChange?: () => void
}

/** Aranan kelimeyi case-insensitive regex ile vurgular. (bkz:) yapısını bozmaz. */
function highlightText(text: string, searchTerm: string): React.ReactNode[] {
  if (!searchTerm.trim()) return [text]
  const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`(${escaped})`, "gi")
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) {
      parts.push(text.slice(lastIndex, m.index))
    }
    parts.push(
      <mark key={key++} className="bg-yellow-400/50 text-inherit rounded px-1">
        {m[1]}
      </mark>
    )
    lastIndex = regex.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : [text]
}

export function EntryCard({
  entry,
  showTopicTitle = true,
  searchTerm,
  activeTab,
  onTopicClick,
  isLoggedIn = false,
  onLoginClick,
  onVoteSuccess,
  currentUser,
  onEntryChange,
}: EntryCardProps) {
  const [userVote, setUserVote] = useState<"up" | "down" | null>(entry.userVote ?? null)
  const [upvotes, setUpvotes] = useState(entry.upvotes)
  const [downvotes, setDownvotes] = useState(entry.downvotes)
  const [isVoting, setIsVoting] = useState(false)
  const [content, setContent] = useState(entry.content)
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(entry.updatedAt ?? null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [saveCount, setSaveCount] = useState(entry.saveCount ?? 0)
  const [isSaved, setIsSaved] = useState(entry.isSavedByCurrentUser ?? false)
  const [isSaving, setIsSaving] = useState(false)
  const [isReportOpen, setIsReportOpen] = useState(false)
  const [isAdminDeleteOpen, setIsAdminDeleteOpen] = useState(false)
  const [isAdminDeleting, setIsAdminDeleting] = useState(false)
  const [isLikersOpen, setIsLikersOpen] = useState(false)

  /** Backend + istemci: entry sahibi (anonim entry'de AuthorId maskeli olsa da canManage doğru gelir). */
  const canManage = entry.canManage ?? (!!currentUser && currentUser.id === entry.author.id)
  const isAdmin = currentUser?.role === "Admin"
  const isAnonymousEntry = entry.isAnonymous ?? entry.author?.nickname === "Anonim"

  useEffect(() => {
    setUserVote(entry.userVote ?? null)
    setUpvotes(entry.upvotes)
    setDownvotes(entry.downvotes)
    setContent(entry.content)
    setSaveCount(entry.saveCount ?? 0)
    setIsSaved(entry.isSavedByCurrentUser ?? false)
    setLocalUpdatedAt(entry.updatedAt ?? null)
  }, [entry.id, entry.userVote, entry.upvotes, entry.downvotes, entry.content, entry.saveCount, entry.isSavedByCurrentUser, entry.updatedAt])

  const handleEdit = async () => {
    const trimmedContent = content.trim()
    const plainText = trimmedContent.replace(/<[^>]*>/g, "").trim()
    if (!plainText) {
      setEditError("İçerik boş olamaz.")
      return
    }
    setIsEditSaving(true)
    setEditError(null)
    const savedContent = trimmedContent
    try {
      const res = await fetch(getApiUrl(`api/Entries/${entry.id}`), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: trimmedContent }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : (data.message ?? data.title ?? "Düzenleme başarısız"))
      }
      // Sayfa yenilenmeden anlık güncelleme — sadece bu kartın local state'i değişir
      setContent(data.content ?? savedContent)
      setLocalUpdatedAt(data.updatedAt ?? new Date().toISOString())
      setIsEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsEditSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(getApiUrl(`api/Entries/${entry.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data === "string" ? data : (data.message ?? data.title ?? "Silme başarısız")
        throw new Error(msg)
      }
      setIsDeleteOpen(false)
      onEntryChange?.()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSaveToggle = async () => {
    if (!isLoggedIn) {
      onLoginClick?.()
      return
    }
    if (isSaving) return
    setIsSaving(true)
    const prevCount = saveCount
    const prevSaved = isSaved
    try {
      const res = await fetch(getApiUrl(`api/Entries/${entry.id}/save`), {
        method: "POST",
        headers: getAuthHeaders(),
      })
      if (res.status === 401) {
        onLoginClick?.()
        return
      }
      if (!res.ok) throw new Error("Kaydetme işlemi başarısız")
      const data = await res.json().catch(() => ({}))
      setSaveCount(data.saveCount ?? prevCount)
      setIsSaved(data.isSavedByCurrentUser ?? prevSaved)
    } catch {
      setSaveCount(prevCount)
      setIsSaved(prevSaved)
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdminDelete = async () => {
    setIsAdminDeleting(true)
    try {
      const res = await fetch(getApiUrl(`api/Admin/entries/${entry.id}`), {
        method: "DELETE",
        headers: getAuthHeaders(),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(typeof data === "string" ? data : (data.message ?? "Silme başarısız"))
      }
      setIsAdminDeleteOpen(false)
      onEntryChange?.()
    } finally {
      setIsAdminDeleting(false)
    }
  }

  const handleVote = async (type: "up" | "down") => {
    if (!isLoggedIn) {
      onLoginClick?.()
      return
    }

    if (isVoting) return

    // --- Optimistic UI: anlık görsel güncelleme ---
    const prevUp = upvotes
    const prevDown = downvotes
    const prevVote = userVote

    // Aynı butona tekrar basmak → oy geri alınır (toggle). Farklı butona → switch (mutual exclusive).
    const optimisticVote: "up" | "down" | null = userVote === type ? null : type
    const upDelta = (optimisticVote === "up" ? 1 : 0) - (userVote === "up" ? 1 : 0)
    const downDelta = (optimisticVote === "down" ? 1 : 0) - (userVote === "down" ? 1 : 0)

    setUserVote(optimisticVote)
    setUpvotes((prev) => prev + upDelta)
    setDownvotes((prev) => prev + downDelta)
    setIsVoting(true)

    const endpoint = type === "up" ? "upvote" : "downvote"
    const url = getApiUrl(`api/Entries/${entry.id}/${endpoint}`)

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
      })

      if (!res.ok) {
        if (res.status === 401) {
          onLoginClick?.()
          // 401'de state'i geri al
          setUserVote(prevVote)
          setUpvotes(prevUp)
          setDownvotes(prevDown)
          return
        }
        throw new Error("Oylama gönderilemedi")
      }

      // Sunucudan gelen kesin sayılarla güncelle
      const data = await res.json().catch(() => ({}))
      const serverVote: "up" | "down" | null =
        data.userVoteType === 1 ? "up" : data.userVoteType === -1 ? "down" : null
      setUpvotes(data.upvotes ?? prevUp + upDelta)
      setDownvotes(data.downvotes ?? prevDown + downDelta)
      setUserVote(serverVote)
    } catch {
      // Hata → optimistic güncellemeyi geri al
      setUpvotes(prevUp)
      setDownvotes(prevDown)
      setUserVote(prevVote)
    } finally {
      setIsVoting(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const formatEditTimestamp = (dateString: string) => {
    const d = new Date(dateString)
    if (Number.isNaN(d.getTime())) return ""
    return format(d, "d MMMM yyyy HH:mm", { locale: tr })
  }

  const createdMs = new Date(entry.date).getTime()
  const updatedMs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
  const showEditTimestamp =
    !!localUpdatedAt && !Number.isNaN(updatedMs) && !Number.isNaN(createdMs) && updatedMs > createdMs

  const editLineText =
    showEditTimestamp && localUpdatedAt ? formatEditTimestamp(localUpdatedAt) : ""

  const accentBorderColor =
    activeTab === "discover"
      ? "border-l-[#f28f35]"
      : activeTab === "following"
      ? "border-l-[#55d197]"
      : "border-l-[#2c64f6]"

  return (
    <article
      id={`entry-${entry.id}`}
      className={cn(
        "group bg-card border border-border border-l-2 rounded-lg p-5 transition-all duration-200 hover:bg-[#2a2b2e] min-w-0 w-full max-w-full",
        accentBorderColor
      )}
      style={{ backgroundColor: '#252728' }}
    >
      {/* Topic Title */}
      {showTopicTitle && (
        <div className="mb-4 min-w-0 w-full max-w-full">
          <button
            type="button"
            onClick={() => onTopicClick?.(entry.topicId)}
            className="select-text text-slate-200 dark:text-slate-300 text-xl font-bold leading-[1.35] tracking-[-0.01em] block text-left w-full min-w-0 max-w-full break-words whitespace-pre-wrap transition-opacity hover:opacity-75"
          >
            {entry.topicTitle}
          </button>
        </div>
      )}

      {/* Content */}
      <div className="entry-content mb-4 min-w-0 w-full max-w-full">
        <ExpandableHtmlContent
          html={content}
          rendererClassName={ENTRY_BODY_RENDERER_CLASSNAME}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50 gap-2 flex-wrap min-w-0 w-full">

        {/* LEFT GROUP: Vote actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Upvote */}
          <button
            onClick={() => handleVote("up")}
            disabled={isVoting}
            title="Kalp at"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "up"
                ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-200 dark:ring-rose-800/40"
                : "text-[#7c8190] hover:text-rose-500 hover:bg-rose-50/60 dark:hover:bg-rose-950/20"
            )}
            aria-label="Kalp at"
          >
            <Heart className={cn("h-4 w-4 transition-transform duration-100", userVote === "up" ? "fill-current scale-110" : "")} />
            <span className={cn("tabular-nums text-[13px]", userVote === "up" && "font-semibold")}>
              {upvotes}
            </span>
          </button>

          {/* Downvote (Butt icon) */}
          <button
            onClick={() => handleVote("down")}
            disabled={isVoting}
            title="Ayak at"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "down"
                ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-800/40"
                : "text-[#7c8190] hover:text-amber-600 hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
            )}
            aria-label="Ayak at"
          >
            <AyakIcon filled={userVote === "down"} />
            <span className={cn("tabular-nums text-[13px]", userVote === "down" && "font-semibold")}>
              {downvotes}
            </span>
          </button>

          {/* Save */}
          <button
            onClick={handleSaveToggle}
            disabled={isSaving}
            title="Çivile"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              isSaved
                ? "text-purple-500 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-950/30 ring-1 ring-purple-500/30 dark:ring-purple-400/25"
                : "text-[#7c8190] hover:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-950/20"
            )}
            aria-label="Çivile"
          >
            <CiviIcon className={cn("transition-transform duration-100", isSaved ? "scale-110" : "")} />
            <span className={cn("tabular-nums text-[13px]", isSaved && "font-semibold")}>{saveCount}</span>
          </button>
        </div>

        {/* RIGHT GROUP: Author info + date + share + options */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {/* Avatar */}
          <div className="shrink-0">
            {isAnonymousEntry ? (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
            ) : entry.author?.avatar?.startsWith("http") ? (
              <img
                src={entry.author.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-5 w-5 rounded-full object-cover border border-border/60"
              />
            ) : entry.author?.avatar ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/80 text-sm border border-border/60 leading-none">
                {entry.author.avatar}
              </span>
            ) : (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  {(entry.author?.nickname?.charAt(0) ?? "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Author name */}
          {isAnonymousEntry ? (
            <span className="text-sm font-normal text-slate-200 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap inline-block">
              {searchTerm?.trim()
                ? highlightText(entry.author?.nickname ?? "Anonim", searchTerm)
                : (entry.author?.nickname ?? "Anonim")}
            </span>
          ) : (
            <Link
              href={`/user/${entry.author.id}`}
              className="inline-flex items-center gap-0.5 text-sm font-normal text-slate-200 hover:text-[#c2c6cf] transition-colors max-w-[220px] overflow-hidden"
            >
              {searchTerm?.trim()
                ? highlightText(entry.author.nickname, searchTerm)
                : entry.author.nickname}
              {entry.author.role === "Admin" && (
                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
              )}
            </Link>
          )}

          <span className="text-[#7c8190]/45 text-[13px] shrink-0">·</span>

          {/* Tarih + Edit: (alt alta) */}
          <div className="hidden sm:flex flex-col items-end shrink-0 gap-0.5 text-right">
            <span className="text-[#7c8190] text-[13px] leading-tight tabular-nums">
              {formatDate(entry.date)}
            </span>
            {editLineText !== "" && (
              <span className="text-[#7c8190] text-[13px] italic leading-tight">
                Edit: {editLineText}
              </span>
            )}
          </div>

          {/* Share */}
          <ShareMenu
            url={`${getSiteUrl()}/entry/${entry.id}`}
            title={`${entry.topicTitle} - ${entry.author?.nickname ?? "Anonim"} | Tespit Sözlük`}
            className="text-[#7c8190] text-[13px] hover:text-[#c2c6cf] px-1.5 py-1 rounded-lg hover:bg-muted/60 transition-colors"
            tooltipTitle="Paylaş"
          />

          {/* Options: tek menü — sahibiyse yönetim + herkese şikayet + admin sil */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center h-7 w-7 rounded-lg text-[#7c8190] hover:text-[#c2c6cf] hover:bg-muted/60 transition-colors"
                aria-label="Diğer seçenekler"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[170px]">
              {canManage && (
                <>
                  <DropdownMenuItem onClick={() => setIsLikersOpen(true)}>
                    <Users className="h-4 w-4" />
                    Kalp atanları gör
                  </DropdownMenuItem>
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
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setIsReportOpen(true)}>
                <Flag className="h-4 w-4" />
                Şikayet Et
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setIsAdminDeleteOpen(true)}
                >
                  <ShieldX className="h-4 w-4" />
                  Admin: Kalıcı Sil
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ReportDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        targetId={entry.id}
        targetType="entry"
      />

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditError(null) }}>
        <DialogContent
          className={cn(
            "w-full max-w-[calc(100%-2rem)] min-w-0 overflow-x-hidden p-5 gap-4",
            FEED_COLUMN_MAX_WIDTH_CLASS
          )}
        >
          <DialogHeader>
            <DialogTitle>Entry Düzenle</DialogTitle>
          </DialogHeader>
          <div className="min-w-0 max-w-full space-y-2 overflow-x-hidden">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="İçeriği yazın..."
              bodyScrollMaxHeightClass="max-h-[60vh]"
              innerContentPaddingClassName="px-[0.7rem]"
            />
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>İptal</Button>
            <Button onClick={handleEdit} disabled={isEditSaving}>
              {isEditSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={(open) => { setIsDeleteOpen(open); if (!open) setDeleteError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              Bu entry kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete() }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin: Kalıcı Silme Modalı */}
      <DangerConfirmModal
        isOpen={isAdminDeleteOpen}
        onClose={() => setIsAdminDeleteOpen(false)}
        onConfirm={handleAdminDelete}
        title="Entry'yi Kalıcı Sil"
        warningText="Bu entry veritabanından kalıcı olarak silinecek. Yazar veya konu fark etmeksizin tüm iz yok edilecek."
        expectedText="sil"
        confirmLabel="Kalıcı Olarak Sil"
        isLoading={isAdminDeleting}
      />

      <EntryLikersModal
        open={isLikersOpen}
        onOpenChange={setIsLikersOpen}
        entryId={entry.id}
      />
    </article>
  )
}
