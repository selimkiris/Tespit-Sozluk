"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Heart, MoreHorizontal, Pencil, Trash2, User, Bookmark, Flag, ShieldX, BadgeCheck } from "lucide-react"
import { ShareMenu } from "@/components/share-menu"
import { getSiteUrl } from "@/lib/api"
import { PoopIcon } from "@/components/icons/poop-icon"
import { cn } from "@/lib/utils"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { HtmlRenderer } from "@/components/html-renderer"
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
  }, [entry.id, entry.userVote, entry.upvotes, entry.downvotes, entry.content, entry.saveCount, entry.isSavedByCurrentUser])

  const handleEdit = async () => {
    const trimmed = content.replace(/<[^>]*>/g, "").trim()
    if (!trimmed) {
      setEditError("İçerik boş olamaz.")
      return
    }
    setIsEditSaving(true)
    setEditError(null)
    try {
      const res = await fetch(getApiUrl(`api/Entries/${entry.id}`), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ content: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : (data.message ?? data.title ?? "Düzenleme başarısız"))
      }
      setIsEditOpen(false)
      onEntryChange?.()
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
      onVoteSuccess?.()
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

    setIsVoting(true)
    const prevUp = upvotes
    const prevDown = downvotes
    const prevVote = userVote

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
          return
        }
        throw new Error("Oylama gönderilemedi")
      }

      const data = await res.json().catch(() => ({}))
      const newUp = data.upvotes ?? prevUp
      const newDown = data.downvotes ?? prevDown
      const newUserVote: "up" | "down" | null =
        data.userVoteType === 1 ? "up" : data.userVoteType === -1 ? "down" : null

      setUpvotes(newUp)
      setDownvotes(newDown)
      setUserVote(newUserVote)
      onVoteSuccess?.()
    } catch {
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

  const formatEditDate = (dateString: string) => {
    const d = new Date(dateString)
    const day = String(d.getDate()).padStart(2, "0")
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const year = d.getFullYear()
    const h = String(d.getHours()).padStart(2, "0")
    const m = String(d.getMinutes()).padStart(2, "0")
    return `${day}.${month}.${year} ${h}:${m}`
  }

  return (
    <article className="group bg-card border border-border rounded-lg p-5 transition-colors hover:border-border/80">
      {/* Topic Title + Actions */}
      <div className="flex items-start justify-between gap-2 mb-3">
        {showTopicTitle ? (
          <button
            onClick={() => onTopicClick?.(entry.topicId)}
            className="text-sm font-medium text-foreground hover:underline underline-offset-2 block text-left flex-1 min-w-0 break-all hyphens-auto whitespace-pre-wrap"
          >
            {entry.topicTitle}
          </button>
        ) : (
          <div className="flex-1" />
        )}
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
      </div>

      {/* Content */}
      <div className="text-foreground leading-relaxed mb-4">
        <HtmlRenderer html={entry.content} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        {/* Author & Date */}
        <div className="flex items-center gap-2 text-sm">
          {isAnonymousEntry ? (
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
          ) : entry.author?.avatar?.startsWith("http") ? (
            <img src={entry.author.avatar} alt="" className="h-6 w-6 shrink-0 rounded-full object-cover border border-border/60" />
          ) : entry.author?.avatar ? (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-base border border-border/60">
              {entry.author.avatar}
            </span>
          ) : (
            <Avatar className="h-6 w-6 shrink-0">
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                {(entry.author?.nickname?.charAt(0) ?? "?").toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          {isAnonymousEntry ? (
            <span className="text-muted-foreground">
              {searchTerm?.trim()
                ? highlightText(entry.author?.nickname ?? "Anonim", searchTerm)
                : (entry.author?.nickname ?? "Anonim")}
            </span>
          ) : (
            <Link
              href={`/user/${entry.author.id}`}
              className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {searchTerm?.trim()
                ? highlightText(entry.author.nickname, searchTerm)
                : entry.author.nickname}
              {entry.author.role === "Admin" && (
                <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
              )}
            </Link>
          )}
          <span className="text-muted-foreground/50">·</span>
          <span className="text-muted-foreground text-xs">
            {formatDate(entry.date)}
            {entry.updatedAt && (
              <span className="italic text-muted-foreground/80 text-sm ml-1">
                (Düzenlendi {formatEditDate(entry.updatedAt)})
              </span>
            )}
          </span>
        </div>

        {/* Vote Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleVote("up")}
            disabled={isVoting}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "up"
                ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30"
                : "text-muted-foreground hover:text-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
            )}
            aria-label="Beğen"
          >
            <Heart className={cn("h-4 w-4", userVote === "up" && "fill-current")} />
            <span className="text-xs tabular-nums font-medium">{upvotes}</span>
          </button>
          <button
            onClick={() => handleVote("down")}
            disabled={isVoting}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "down"
                ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            )}
            aria-label="Beğenme"
          >
            <PoopIcon filled={userVote === "down"} />
            <span className="text-xs tabular-nums font-medium">{downvotes}</span>
          </button>
          <button
            onClick={handleSaveToggle}
            disabled={isSaving}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed",
              isSaved
                ? "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
                : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
            )}
            aria-label="Kaydet"
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
            <span className="text-xs tabular-nums font-medium">{saveCount}</span>
          </button>
          <ShareMenu
            url={`${getSiteUrl()}/entry/${entry.id}`}
            title={`${entry.topicTitle} - ${entry.author?.nickname ?? "Anonim"} | Tespit Sözlük`}
            className="text-muted-foreground hover:text-foreground px-2.5 py-1.5"
          />
          <button
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Şikayet et"
          >
            <Flag className="h-4 w-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setIsAdminDeleteOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
              aria-label="Admin: Entry'yi sil"
              title="Admin: Kalıcı Sil"
            >
              <ShieldX className="h-4 w-4" />
            </button>
          )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entry Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="İçeriği yazın..."
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
    </article>
  )
}
