"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Heart, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
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
  updatedAt?: string | null
  upvotes: number
  downvotes: number
  userVote?: "up" | "down" | null
  /** Backend-validated (bkz:) - sadece DB'de var olan başlıklar. Key: Topic Title, Value: Topic Id */
  validBkzs?: Record<string, string> | null
}

interface EntryCardProps {
  entry: Entry
  showTopicTitle?: boolean
  onTopicClick?: (topicId: string) => void
  isLoggedIn?: boolean
  onLoginClick?: () => void
  onVoteSuccess?: () => void
  currentUser?: { id: string } | null
  onEntryChange?: () => void
}

export function EntryCard({
  entry,
  showTopicTitle = true,
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

  const canManage = !!currentUser && currentUser.id === entry.author.id

  useEffect(() => {
    setUserVote(entry.userVote ?? null)
    setUpvotes(entry.upvotes)
    setDownvotes(entry.downvotes)
    setContent(entry.content)
  }, [entry.id, entry.userVote, entry.upvotes, entry.downvotes, entry.content])

  const renderContentWithBkz = (text: string, validBkzs: Record<string, string> | null | undefined): React.ReactNode[] => {
    const regex = /\(bkz:\s*([^)]+)\)/gi
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let keyIndex = 0
    let match
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      const term = match[1].trim()
      const found = validBkzs && Object.entries(validBkzs).find(([title]) => title.toLowerCase() === term.toLowerCase())
      const topicId = found ? found[1] : null
      if (topicId) {
        parts.push(
          <Link
            key={`bkz-${keyIndex++}`}
            href={`/?topic=${topicId}`}
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            {match[0]}
          </Link>
        )
      } else {
        parts.push(<span key={`bkz-${keyIndex++}`}>{match[0]}</span>)
      }
      lastIndex = regex.lastIndex
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    return parts.length > 0 ? parts : [text]
  }

  const handleEdit = async () => {
    const trimmed = content.trim()
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
            className="text-sm font-medium text-foreground hover:underline underline-offset-2 block text-left flex-1 min-w-0 whitespace-normal break-words"
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
      <div className="text-foreground leading-relaxed whitespace-pre-wrap mb-4">
        {renderContentWithBkz(entry.content, entry.validBkzs)}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50">
        {/* Author & Date */}
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={`/user/${entry.author.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {entry.author.nickname}
          </Link>
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
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entry Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="İçeriği yazın..."
              className="min-h-24"
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
    </article>
  )
}
