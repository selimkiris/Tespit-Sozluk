"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Heart, MoreHorizontal, Pencil, Trash2, User, Users, Flag, ShieldX, BadgeCheck, MessageCircle } from "lucide-react"
import { ShareMenuSub } from "@/components/share-menu"
import { getApiUrl, apiFetch, getSiteUrl } from "@/lib/api"
import { CiviIcon } from "@/components/icons/CiviIcon"
import { AyakIcon } from "@/components/icons/AyakIcon"
import { cn } from "@/lib/utils"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ExpandableHtmlContent } from "@/components/expandable-html-content"
import { PollDisplay, type ApiPoll } from "@/components/poll-display"
import {
  type PollComposerValue,
  isPollValid,
} from "@/components/poll-composer"
import {
  type EntryPollSubmission,
  pollComposerValueFromApiPoll,
} from "@/lib/entry-poll"
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
import { trimComposerHtml } from "@/lib/composer-guard"
import { UnsavedChangesAlertDialog } from "@/components/unsaved-changes-alert-dialog"
import { useBeforeunloadWarning } from "@/hooks/use-beforeunload-warning"
import { useInternalNavigationGuard } from "@/hooks/use-internal-navigation-guard"
import {
  ENTRY_SEARCH_HIGHLIGHT_MARK_CLASS,
  shouldApplyEntrySearchHighlight,
} from "@/lib/search-highlight-html"
import { formatTurkeyDateTime } from "@/lib/turkey-datetime"
import { NoviceBadge, shouldShowNoviceBadge } from "@/components/novice-badge"
import { SendMessageDialog } from "@/components/send-message-dialog"

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
  /** API: yazarın çömez (novice) statüsü. */
  isNovice?: boolean
  /** Opsiyonel anket. Null/undefined ise bu entry'ye bağlı anket yoktur. */
  poll?: ApiPoll | null
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
  /** Başlık detayından açıldıysa referans linki için SEO slug (opsiyonel). */
  messageContextTopicSlug?: string | null
}

/** Düz metinde aranan kelimeyi vurgular (yazar adı); entry gövdesi HtmlRenderer ile aynı eşik ve sınıflar. */
function highlightText(text: string, searchTerm: string): React.ReactNode[] {
  if (!shouldApplyEntrySearchHighlight(searchTerm)) return [text]
  const q = searchTerm.trim()
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
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
      <mark key={key++} className={ENTRY_SEARCH_HIGHLIGHT_MARK_CLASS}>
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
  messageContextTopicSlug,
}: EntryCardProps) {
  const router = useRouter()
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
  const [editBaseline, setEditBaseline] = useState("")
  const [editLeaveOpen, setEditLeaveOpen] = useState(false)
  const [editPendingNav, setEditPendingNav] = useState<string | null>(null)
  // Anonimlik — edit modalı için toggle state'i ve baseline (dirty kontrolü için)
  const [editIsAnonymous, setEditIsAnonymous] = useState<boolean>(entry.isAnonymous ?? false)
  const [editAnonBaseline, setEditAnonBaseline] = useState<boolean>(entry.isAnonymous ?? false)
  // Poll edit state — baseline (snapshot) ve canlı value
  const [editPoll, setEditPoll] = useState<PollComposerValue | null>(null)
  const [editPollBaseline, setEditPollBaseline] = useState<PollComposerValue | null>(null)
  const [localPoll, setLocalPoll] = useState<ApiPoll | null>(entry.poll ?? null)
  // Anında UI güncellemesi için yerel yazar/anonim görüntü durumu
  const [localIsAnonymous, setLocalIsAnonymous] = useState<boolean>(entry.isAnonymous ?? false)
  const [localAuthor, setLocalAuthor] = useState<Entry["author"]>(entry.author)
  const [localIsNovice, setLocalIsNovice] = useState(entry.isNovice ?? false)
  const [sendMessageOpen, setSendMessageOpen] = useState(false)

  // --- Mikro-animasyon geçici state'leri (yalnızca görsel; API/mantık etkilenmez) ---
  const [heartAnim, setHeartAnim] = useState(false)
  const [ayakAnim, setAyakAnim] = useState(false)
  const [civiAnim, setCiviAnim] = useState(false)
  const animTimers = useRef<{ heart?: ReturnType<typeof setTimeout>; ayak?: ReturnType<typeof setTimeout>; civi?: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    return () => {
      if (animTimers.current.heart) clearTimeout(animTimers.current.heart)
      if (animTimers.current.ayak) clearTimeout(animTimers.current.ayak)
      if (animTimers.current.civi) clearTimeout(animTimers.current.civi)
    }
  }, [])

  const triggerHeartAnim = () => {
    if (animTimers.current.heart) clearTimeout(animTimers.current.heart)
    setHeartAnim(false)
    requestAnimationFrame(() => {
      setHeartAnim(true)
      animTimers.current.heart = setTimeout(() => setHeartAnim(false), 600)
    })
  }
  const triggerAyakAnim = () => {
    if (animTimers.current.ayak) clearTimeout(animTimers.current.ayak)
    setAyakAnim(false)
    requestAnimationFrame(() => {
      setAyakAnim(true)
      animTimers.current.ayak = setTimeout(() => setAyakAnim(false), 750)
    })
  }
  const triggerCiviAnim = () => {
    if (animTimers.current.civi) clearTimeout(animTimers.current.civi)
    setCiviAnim(false)
    requestAnimationFrame(() => {
      setCiviAnim(true)
      animTimers.current.civi = setTimeout(() => setCiviAnim(false), 600)
    })
  }

  /** Backend + istemci: entry sahibi (anonim entry'de AuthorId maskeli olsa da canManage doğru gelir). */
  const canManage = entry.canManage ?? (!!currentUser && currentUser.id === entry.author.id)
  const isAdmin = currentUser?.role === "Admin"
  const isAnonymousEntry = localIsAnonymous || localAuthor?.nickname === "Anonim"
  const emptyAuthorGuid = "00000000-0000-0000-0000-000000000000"
  const showSendMessage =
    isLoggedIn &&
    !canManage &&
    !!localAuthor?.id &&
    localAuthor.id !== emptyAuthorGuid &&
    !!currentUser?.id &&
    currentUser.id !== localAuthor.id

  useEffect(() => {
    setUserVote(entry.userVote ?? null)
    setUpvotes(entry.upvotes)
    setDownvotes(entry.downvotes)
    setContent(entry.content)
    setSaveCount(entry.saveCount ?? 0)
    setIsSaved(entry.isSavedByCurrentUser ?? false)
    setLocalUpdatedAt(entry.updatedAt ?? null)
    setLocalIsAnonymous(entry.isAnonymous ?? false)
    setLocalAuthor(entry.author)
    setLocalIsNovice(entry.isNovice ?? false)
    setLocalPoll(entry.poll ?? null)
  }, [entry.id, entry.userVote, entry.upvotes, entry.downvotes, entry.content, entry.saveCount, entry.isSavedByCurrentUser, entry.updatedAt, entry.isAnonymous, entry.isNovice, entry.author, entry.poll])

  const editPollSnapshot = JSON.stringify(editPoll)
  const editPollBaselineSnapshot = JSON.stringify(editPollBaseline)
  const isEditDirty =
    isEditOpen &&
    (trimComposerHtml(content) !== trimComposerHtml(editBaseline) ||
      editIsAnonymous !== editAnonBaseline ||
      editPollSnapshot !== editPollBaselineSnapshot)

  useBeforeunloadWarning(isEditDirty)
  useInternalNavigationGuard(isEditDirty, (path) => {
    setEditPendingNav(path)
    setEditLeaveOpen(true)
  })

  const closeEditDialog = () => {
    setIsEditOpen(false)
    setEditError(null)
  }

  const requestCloseEdit = () => {
    if (isEditDirty) {
      setEditPendingNav(null)
      setEditLeaveOpen(true)
      return
    }
    closeEditDialog()
  }

  const performEditSave = async (): Promise<boolean> => {
    const trimmedContent = content.trim()
    const plainText = trimmedContent.replace(/<[^>]*>/g, "").trim()
    const hasPoll = editPoll !== null
    if (!plainText && !hasPoll) {
      setEditError("İçerik veya anket gerekli.")
      return false
    }
    if (hasPoll && !isPollValid(editPoll)) {
      setEditError("Anket eksik. Soruyu doldurun ve en az 2 farklı seçenek girin.")
      return false
    }
    setIsEditSaving(true)
    setEditError(null)
    const savedContent = trimmedContent
    const anonChanged = editIsAnonymous !== (entry.isAnonymous ?? false)
    try {
      const body: {
        content: string
        isAnonymous: boolean
        poll?: EntryPollSubmission
        removePoll?: boolean
      } = {
        content: trimmedContent,
        isAnonymous: editIsAnonymous,
      }
      if (hasPoll) {
        body.poll = {
          question: editPoll!.question.trim(),
          options: editPoll!.options.map((o) => o.trim()).filter((o) => o.length > 0),
          allowMultiple: editPoll!.allowMultiple,
          allowUserOptions: editPoll!.allowUserOptions,
        }
      } else if (entry.poll) {
        body.removePoll = true
      }
      const res = await apiFetch(getApiUrl(`api/Entries/${entry.id}`), {
        method: "PUT",
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data === "string" ? data : (data.message ?? data.title ?? "Düzenleme başarısız"))
      }
      setContent(data.content ?? savedContent)
      setLocalUpdatedAt(data.updatedAt ?? new Date().toISOString())
      if (data.poll !== undefined) {
        setLocalPoll((data.poll as ApiPoll | null) ?? null)
      } else if (!hasPoll && entry.poll) {
        setLocalPoll(null)
      }
      // Anonimlik değiştiyse yazar görüntüsünü backend yanıtı + toggle değerine göre güncelle
      const nextAnon: boolean = typeof data.isAnonymous === "boolean" ? data.isAnonymous : editIsAnonymous
      setLocalIsAnonymous(nextAnon)
      setEditAnonBaseline(nextAnon)
      if (nextAnon) {
        setLocalAuthor({
          id: entry.author.id,
          nickname: data.authorName ?? "Anonim",
          avatar: null,
          role: "User",
        })
        setLocalIsNovice(false)
      } else {
        setLocalAuthor({
          id: data.authorId ?? entry.author.id,
          nickname: data.authorName ?? entry.author.nickname,
          avatar: data.authorAvatar ?? entry.author.avatar ?? null,
          role: data.authorRole ?? entry.author.role ?? "User",
        })
        if (typeof data.isNovice === "boolean") {
          setLocalIsNovice(data.isNovice)
        }
      }
      setIsEditOpen(false)
      // Eğer anonimlik değiştiyse, ilk entry'de topic header'ı da güncellemek için
      // üst bileşene haber ver (o liste/topic'i yeniden çekecek).
      if (anonChanged) {
        onEntryChange?.()
      }
      return true
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Bir hata oluştu")
      return false
    } finally {
      setIsEditSaving(false)
    }
  }

  const saveEditFromGuard = async () => {
    const nav = editPendingNav
    setEditPendingNav(null)
    const ok = await performEditSave()
    if (ok) {
      setEditLeaveOpen(false)
      if (nav) router.push(nav)
    } else {
      setEditLeaveOpen(false)
    }
  }

  const handleEdit = () => void performEditSave()

  const handleDelete = async () => {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Entries/${entry.id}`), {
        method: "DELETE",
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
      const res = await apiFetch(getApiUrl(`api/Entries/${entry.id}/save`), {
        method: "POST",
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
      const res = await apiFetch(getApiUrl(`api/Admin/entries/${entry.id}`), {
        method: "DELETE",
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
      const res = await apiFetch(url, {
        method: "POST",
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

  const formatDate = (dateString: string) => formatTurkeyDateTime(dateString)

  const createdMs = new Date(entry.date).getTime()
  const updatedMs = localUpdatedAt ? new Date(localUpdatedAt).getTime() : 0
  const showEditTimestamp =
    !!localUpdatedAt && !Number.isNaN(updatedMs) && !Number.isNaN(createdMs) && updatedMs > createdMs

  const editLineText =
    showEditTimestamp && localUpdatedAt ? formatDate(localUpdatedAt) : ""

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
          searchHighlightQuery={searchTerm}
        />
        {localPoll && (
          <PollDisplay
            poll={localPoll}
            isLoggedIn={isLoggedIn}
            onLoginClick={onLoginClick}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border/50 gap-2 flex-wrap min-w-0 w-full">

        {/* LEFT GROUP: Vote actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Upvote */}
          <button
            onClick={() => {
              if (!isVoting) triggerHeartAnim()
              handleVote("up")
            }}
            disabled={isVoting}
            title="Kalp at"
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "up"
                ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 ring-1 ring-rose-200 dark:ring-rose-800/40"
                : "text-[#7c8190] hover:text-rose-500 hover:bg-rose-50/60 dark:hover:bg-rose-950/20"
            )}
            aria-label="Kalp at"
          >
            <span className="relative inline-flex items-center justify-center">
              <Heart
                className={cn(
                  "h-4 w-4 transition-transform duration-100",
                  userVote === "up" && "fill-current scale-110",
                  heartAnim && "animate-heart-pop fill-current"
                )}
              />
              {heartAnim && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -m-1 rounded-full animate-heart-pop"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(244,63,94,0.35) 0%, rgba(244,63,94,0.12) 55%, transparent 75%)",
                  }}
                />
              )}
            </span>
            <span className={cn("tabular-nums text-[13px]", userVote === "up" && "font-semibold")}>
              {upvotes}
            </span>
          </button>

          {/* Downvote (Ayak icon) */}
          <button
            onClick={() => {
              if (!isVoting) triggerAyakAnim()
              handleVote("down")
            }}
            disabled={isVoting}
            title="Ayak at"
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              userVote === "down"
                ? "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 ring-1 ring-amber-200 dark:ring-amber-800/40"
                : "text-[#7c8190] hover:text-amber-600 hover:bg-amber-50/60 dark:hover:bg-amber-950/20"
            )}
            aria-label="Ayak at"
          >
            <span className="relative inline-flex items-center justify-center">
              {ayakAnim && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -m-2 rounded-full animate-ayak-aura"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(132,204,22,0.55) 0%, rgba(132,204,22,0.25) 45%, transparent 72%)",
                    boxShadow:
                      "0 0 14px 4px rgba(132,204,22,0.35), 0 0 28px 6px rgba(101,163,13,0.25)",
                  }}
                />
              )}
              <AyakIcon
                filled={userVote === "down"}
                className={cn(ayakAnim && "animate-ayak-wobble")}
              />
            </span>
            <span className={cn("tabular-nums text-[13px]", userVote === "down" && "font-semibold")}>
              {downvotes}
            </span>
          </button>

          {/* Save (Çivi) */}
          <button
            onClick={() => {
              if (!isSaving) triggerCiviAnim()
              handleSaveToggle()
            }}
            disabled={isSaving}
            title="Çivile"
            className={cn(
              "relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[13px] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed",
              isSaved
                ? "text-purple-500 dark:text-purple-400 bg-purple-500/10 dark:bg-purple-950/30 ring-1 ring-purple-500/30 dark:ring-purple-400/25"
                : "text-[#7c8190] hover:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-950/20"
            )}
            aria-label="Çivile"
          >
            <span className="relative inline-flex items-center justify-center">
              <CiviIcon
                className={cn(
                  "transition-transform duration-100",
                  isSaved && "scale-110",
                  civiAnim && "animate-civi-slam"
                )}
              />
              {civiAnim && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 -bottom-1 h-[3px] w-5 rounded-full animate-civi-impact"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, rgba(168,85,247,0.85) 0%, rgba(168,85,247,0.35) 60%, transparent 100%)",
                    boxShadow: "0 0 10px 2px rgba(168,85,247,0.45)",
                  }}
                />
              )}
            </span>
            <span className={cn("tabular-nums text-[13px]", isSaved && "font-semibold")}>{saveCount}</span>
          </button>
        </div>

        {/* RIGHT GROUP: Author info + date + share + options — sıra: rozet (çömez) | avatar | ad */}
        <div className="flex items-center gap-1.5 min-w-0 shrink">
          {!isAnonymousEntry && shouldShowNoviceBadge(localIsNovice, localAuthor.role) && (
            <NoviceBadge className="shrink-0" />
          )}
          {/* Avatar */}
          <div className="shrink-0">
            {isAnonymousEntry ? (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  <User className="h-3 w-3" />
                </AvatarFallback>
              </Avatar>
            ) : localAuthor?.avatar?.startsWith("http") ? (
              <img
                src={localAuthor.avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="h-5 w-5 rounded-full object-cover border border-border/60"
              />
            ) : localAuthor?.avatar ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary/80 text-sm border border-border/60 leading-none">
                {localAuthor.avatar}
              </span>
            ) : (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-muted text-muted-foreground text-[10px]">
                  {(localAuthor?.nickname?.charAt(0) ?? "?").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
          </div>

          {/* Author name */}
          {isAnonymousEntry ? (
            <span className="text-sm font-normal text-slate-200 max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap inline-block">
              {shouldApplyEntrySearchHighlight(searchTerm)
                ? highlightText(localAuthor?.nickname ?? "Anonim", searchTerm!)
                : (localAuthor?.nickname ?? "Anonim")}
            </span>
          ) : (
            <Link
              href={`/user/${localAuthor.id}`}
              className="inline-flex items-center gap-0.5 text-sm font-normal text-slate-200 hover:text-[#c2c6cf] transition-colors max-w-[min(100%,220px)] min-w-0 overflow-hidden"
            >
              <span className="min-w-0 truncate">
                {shouldApplyEntrySearchHighlight(searchTerm)
                  ? highlightText(localAuthor.nickname, searchTerm!)
                  : localAuthor.nickname}
              </span>
              {localAuthor.role === "Admin" && (
                <BadgeCheck className="w-3.5 h-3.5 text-blue-500 fill-blue-500/20 ml-0.5 shrink-0" />
              )}
            </Link>
          )}

          <span className="text-[#7c8190]/45 text-[13px] shrink-0">·</span>

          {/* Tarih + Edit: (alt alta) — tüm genişliklerde görünür; sm+ yerleşimi aynı */}
          <div className="flex flex-col items-end shrink-0 gap-0.5 text-right min-w-0 ml-1.5 sm:ml-0">
            <span className="text-[#7c8190] text-[13px] leading-tight tabular-nums">
              {formatDate(entry.date)}
            </span>
            {editLineText !== "" && (
              <span className="text-[#7c8190] text-[13px] italic leading-tight break-words text-right max-w-[min(100%,14rem)] sm:max-w-none">
                Edit: {editLineText}
              </span>
            )}
          </div>

          {/* Options: tek menü — Paylaş + sahibiyse yönetim + şikayet + admin sil */}
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
                  <DropdownMenuItem
                    onClick={() => {
                      setEditBaseline(entry.content)
                      const currentAnon = entry.isAnonymous ?? false
                      setEditIsAnonymous(currentAnon)
                      setEditAnonBaseline(currentAnon)
                      const initialPoll = pollComposerValueFromApiPoll(localPoll ?? entry.poll ?? null)
                      setEditPoll(initialPoll)
                      setEditPollBaseline(initialPoll)
                      setIsEditOpen(true)
                      setEditError(null)
                    }}
                  >
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
              <ShareMenuSub
                url={`${getSiteUrl()}/entry/${entry.id}`}
                title={`${entry.topicTitle} - ${localAuthor?.nickname ?? "Anonim"} | Tespit Sözlük`}
              />
              {showSendMessage && (
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => setSendMessageOpen(true)}
                >
                  <MessageCircle className="h-4 w-4" />
                  Mesaj Gönder
                </DropdownMenuItem>
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

      <SendMessageDialog
        open={sendMessageOpen}
        onOpenChange={setSendMessageOpen}
        recipientId={localAuthor.id}
        recipientDisplayName={localAuthor.nickname}
        reference={
          showSendMessage
            ? {
                kind: "entry",
                entryId: entry.id,
                topicId: entry.topicId,
                topicTitle: entry.topicTitle,
                topicSlug: messageContextTopicSlug,
                bodyHtml: content,
                hasPoll: !!(localPoll ?? entry.poll),
              }
            : null
        }
      />

      <ReportDialog
        open={isReportOpen}
        onOpenChange={setIsReportOpen}
        targetId={entry.id}
        targetType="entry"
      />

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsEditOpen(true)
            return
          }
          if (isEditDirty) {
            setEditPendingNav(null)
            setEditLeaveOpen(true)
            return
          }
          closeEditDialog()
        }}
      >
        <DialogContent
          className={cn(
            "w-full max-w-[calc(100%-2rem)] min-w-0 overflow-x-hidden p-5 gap-0",
            FEED_COLUMN_MAX_WIDTH_CLASS
          )}
        >
          <DialogHeader className="space-y-0 p-0 pb-3 text-left">
            <DialogTitle>Entry Düzenle</DialogTitle>
          </DialogHeader>
          <div className="m-0 min-w-0 max-w-full p-0">
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="İçeriği yazın..."
              bodyScrollMaxHeightClass="max-h-[60vh]"
              innerContentPaddingClassName="px-[14px]"
              toolbarStickyTopClass="top-0"
              poll={editPoll}
              onPollChange={setEditPoll}
              pollDisabled={isEditSaving}
            />
            <div className="mt-3 space-y-1">
              <RadioGroup
                value={editIsAnonymous ? "anonymous" : "account"}
                onValueChange={(v) => setEditIsAnonymous(v === "anonymous")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="account" id={`edit-account-${entry.id}`} />
                  <Label
                    htmlFor={`edit-account-${entry.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    Kendi hesabınla paylaş
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="anonymous" id={`edit-anonymous-${entry.id}`} />
                  <Label
                    htmlFor={`edit-anonymous-${entry.id}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    Tam anonim paylaş
                  </Label>
                </div>
              </RadioGroup>
              {editIsAnonymous && (
                <p className="text-xs text-muted-foreground">
                  Tam Anonim modda paylaşılan entrylerde kullanıcı adı görünmez, profile erişilemez.
                  Kullanıcı adı kısmında sadece "Anonim" yazar ve profil fotoğrafı gösterilmez.
                  Eğer bu entry başlığın ilk entry'siyse başlığın anonimlik durumu da aynı değere çekilir.
                </p>
              )}
            </div>
            {editError && <p className="mt-2 text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={requestCloseEdit}>
              İptal
            </Button>
            <Button
              onClick={handleEdit}
              disabled={
                isEditSaving ||
                (!content.trim().replace(/<[^>]*>/g, "").trim() && editPoll === null) ||
                (editPoll !== null && !isPollValid(editPoll))
              }
            >
              {isEditSaving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesAlertDialog
        mode="entry-edit"
        open={editLeaveOpen}
        onOpenChange={setEditLeaveOpen}
        isPublishing={isEditSaving}
        publishDisabled={
          !content.trim().replace(/<[^>]*>/g, "").trim() && editPoll === null
        }
        onPublish={saveEditFromGuard}
        onDiscard={() => {
          const nav = editPendingNav
          setEditPendingNav(null)
          setContent(editBaseline)
          setEditIsAnonymous(editAnonBaseline)
          setEditPoll(editPollBaseline)
          setEditLeaveOpen(false)
          closeEditDialog()
          if (nav) router.push(nav)
        }}
      />

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
