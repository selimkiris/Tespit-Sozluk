"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ArrowLeft, MoreHorizontal, Pencil, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
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
}

interface TopicDetailProps {
  topic: Topic
  isLoggedIn: boolean
  currentUser?: { id: string } | null
  onBack: () => void
  onSubmitEntry: (content: string) => void
  onLoginClick: () => void
  onVoteSuccess?: () => void
  onTopicChange?: () => void
  refreshTrigger?: number
}

function mapApiEntry(e: { id: string; topicId: string; topicTitle: string; content: string; authorId: string; authorName: string; createdAt: string; upvotes: number; downvotes: number; userVoteType?: number }) {
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
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(topic.title)
  const [isEditSaving, setIsEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const entriesContainerRef = useRef<HTMLDivElement>(null)

  const fetchEntries = useCallback(async (pageNum: number) => {
    setEntriesLoading(true)
    try {
      const res = await fetch(getApiUrl(`api/Topics/${topic.id}/entries?page=${pageNum}&pageSize=10`), {
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
  }, [topic.id])

  useEffect(() => {
    setPage(1)
  }, [topic.id])

  useEffect(() => {
    fetchEntries(page)
  }, [topic.id, page, refreshTrigger, fetchEntries])

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
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground truncate">{topic.title}</h1>
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
          <p className="text-sm text-muted-foreground">{topic.entryCount} entry</p>
        </div>
      </div>

      {/* Edit Topic Dialog */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditError(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Başlığı Düzenle</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Başlık adı..."
            />
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
                isLoggedIn={isLoggedIn}
                onLoginClick={onLoginClick}
                onVoteSuccess={onVoteSuccess}
                currentUser={currentUser}
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
