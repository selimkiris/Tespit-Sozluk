"use client"

import * as React from "react"
import Link from "next/link"
import { MessageSquareText, Users, FileText, BookOpen, EyeOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, apiFetch } from "@/lib/api"
import { topicHref } from "@/lib/topic-href"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

/**
 * API: GET /api/Users/{id}/topics  (UserTopicListItemDto)
 * Sunucu tarafında zaten alfabetik (A→Z) sıralı gelir; ikinci bir sıralama yapılmaz.
 */
type ApiUserTopic = {
  id: string
  title: string
  slug?: string | null
  entryCount?: number
  followerCount?: number
  isAnonymous?: boolean
  createdAt?: string
}

type UserTopic = {
  id: string
  title: string
  slug: string
  entryCount: number
  followerCount: number
  isAnonymous: boolean
}

type UserTopicsModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  /** Başlıkta kullanılan görünen ad (örn. "selimkirci'nin başlıkları"). */
  nickname?: string
  /** Profil sahibi bu modalı kendi profilinde açıyorsa anonim başlıklar da istenir. */
  isOwnProfile?: boolean
}

const FETCH_ERROR_MSG =
  "Başlıklar yüklenirken bir sorun oluştu. Biraz sonra tekrar dener misin?"

export function UserTopicsModal({
  open,
  onOpenChange,
  userId,
  nickname,
  isOwnProfile = false,
}: UserTopicsModalProps) {
  const [topics, setTopics] = React.useState<UserTopic[]>([])
  const [loading, setLoading] = React.useState(false)
  const [errored, setErrored] = React.useState(false)

  React.useEffect(() => {
    if (!open || !userId) return

    const controller = new AbortController()
    const qs = isOwnProfile ? "?includeAnonymous=true" : ""
    setLoading(true)
    setErrored(false)

    apiFetch(getApiUrl(`api/Users/${userId}/topics${qs}`), {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("request-failed")
        const data: ApiUserTopic[] = await res.json()
        const normalized: UserTopic[] = Array.isArray(data)
          ? data.map((t) => ({
              id: String(t.id),
              title: t.title ?? "",
              slug: typeof t.slug === "string" ? t.slug : "",
              entryCount: Number.isFinite(t.entryCount) ? Number(t.entryCount) : 0,
              followerCount: Number.isFinite(t.followerCount) ? Number(t.followerCount) : 0,
              isAnonymous: Boolean(t.isAnonymous),
            }))
          : []
        setTopics(normalized)
      })
      .catch((err) => {
        if (err?.name === "AbortError") return
        setErrored(true)
        setTopics([])
        toast.error(FETCH_ERROR_MSG)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [open, userId, isOwnProfile])

  const title = nickname ? `${nickname} · Açtığı Başlıklar` : "Açtığı Başlıklar"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-4 pr-12 border-b border-border/60">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-base sm:text-lg">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate" title={title}>
              {title}
            </span>
            {!loading && !errored && topics.length > 0 && (
              <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                {topics.length}
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Alfabetik sırayla listelenmiştir.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,600px)] overflow-y-auto px-2 sm:px-3 py-2">
          {loading ? (
            <SkeletonList />
          ) : errored ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              {FETCH_ERROR_MSG}
            </div>
          ) : topics.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-60" aria-hidden />
              Henüz açılmış bir başlık yok.
            </div>
          ) : (
            <ul className="py-1">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link
                    href={topicHref(t)}
                    onClick={() => onOpenChange(false)}
                    className="group flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/60 focus-visible:bg-muted/60 outline-none transition-colors"
                  >
                    <span className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-medium text-foreground group-hover:text-primary group-hover:underline underline-offset-4 decoration-primary/40 truncate">
                        {t.title || "(Başlıksız)"}
                      </span>
                      {t.isAnonymous && (
                        <span
                          title="Anonim başlık"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        >
                          <EyeOff className="h-3 w-3" aria-hidden />
                          Anonim
                        </span>
                      )}
                    </span>

                    <span className="flex items-center gap-1.5 shrink-0">
                      <StatBadge
                        icon={<MessageSquareText className="h-3.5 w-3.5" aria-hidden />}
                        label={`${t.entryCount} entry`}
                        tone="entry"
                        value={t.entryCount}
                      />
                      <StatBadge
                        icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                        label={`${t.followerCount} takipçi`}
                        tone="follower"
                        value={t.followerCount}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Entry ve Takipçi rozetleri tasarımsal olarak birbirinden net ayrılsın diye
 * farklı renk paletleri kullanılır:
 *   • entry    → mavi tonları (MessageSquare ikon)
 *   • follower → yeşil tonları (Users ikon)
 * Böylece renk körü kullanıcılarda bile simge + etiket kombinasyonu koruyucu olur.
 */
function StatBadge({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone: "entry" | "follower"
}) {
  return (
    <span
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        tone === "entry"
          ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      )}
    >
      {icon}
      <span>{value}</span>
    </span>
  )
}

function SkeletonList() {
  return (
    <ul className="py-1 space-y-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg px-3 py-2.5"
        >
          <Skeleton className="h-4 flex-1 max-w-[60%]" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Skeleton className="h-5 w-14 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        </li>
      ))}
    </ul>
  )
}
