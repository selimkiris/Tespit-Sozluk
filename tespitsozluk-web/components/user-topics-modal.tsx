"use client"

import * as React from "react"
import Link from "next/link"
import { FileText, BookOpen, EyeOff } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { getApiUrl, apiFetch } from "@/lib/api"
import { topicHref } from "@/lib/topic-href"
import { toast } from "sonner"

/**
 * API: GET /api/Users/{id}/topics  (UserTopicListItemDto)
 * Sıralama istemci tarafında yapılır; API sözleşmesi değiştirilmez.
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
  isAnonymous: boolean
  createdAt: string
}

type SortMode = "chronological" | "alphabetical"

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

function sortUserTopics(topics: UserTopic[], mode: SortMode): UserTopic[] {
  const copy = [...topics]
  if (mode === "chronological") {
    return copy.sort((a, b) => {
      const ta = Date.parse(a.createdAt)
      const tb = Date.parse(b.createdAt)
      const aTime = Number.isFinite(ta) ? ta : 0
      const bTime = Number.isFinite(tb) ? tb : 0
      if (bTime !== aTime) return bTime - aTime
      return a.id.localeCompare(b.id)
    })
  }
  return copy.sort((a, b) => {
    const cmp = a.title.localeCompare(b.title, "tr-TR", { sensitivity: "base" })
    if (cmp !== 0) return cmp
    return a.id.localeCompare(b.id)
  })
}

export function UserTopicsModal({
  open,
  onOpenChange,
  userId,
  nickname: _nickname,
  isOwnProfile = false,
}: UserTopicsModalProps) {
  const [topics, setTopics] = React.useState<UserTopic[]>([])
  const [loading, setLoading] = React.useState(false)
  const [errored, setErrored] = React.useState(false)
  const [sortMode, setSortMode] = React.useState<SortMode>("chronological")

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
              isAnonymous: Boolean(t.isAnonymous),
              createdAt:
                typeof t.createdAt === "string" && t.createdAt.length > 0
                  ? t.createdAt
                  : "",
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

  const sortedTopics = React.useMemo(
    () => sortUserTopics(topics, sortMode),
    [topics, sortMode],
  )

  const title = isOwnProfile ? "Açtığınız başlıklar" : "Açtığı Başlıklar"

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
          <DialogDescription className="sr-only">
            Kullanıcının açtığı başlıklar listesi
          </DialogDescription>
        </DialogHeader>

        {!loading && !errored && topics.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/60 bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground shrink-0">
              Sıralama:
            </span>
            <Select
              value={sortMode}
              onValueChange={(v) => setSortMode(v as SortMode)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chronological">Kronolojik</SelectItem>
                <SelectItem value="alphabetical">Alfabetik</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

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
              {sortedTopics.map((t) => (
                <li key={t.id}>
                  <Link
                    href={topicHref(t)}
                    onClick={() => onOpenChange(false)}
                    className="group flex items-start gap-3 py-3 -mx-2 px-2 rounded-md hover:bg-muted/30 focus-visible:bg-muted/30 outline-none transition-colors duration-200"
                  >
                    <span className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground whitespace-normal break-words leading-snug transition-opacity group-hover:opacity-70">
                        {t.title || "(Başlıksız)"}
                      </span>
                      {t.isAnonymous && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-zinc-800/40 dark:text-zinc-500 border border-transparent opacity-80 cursor-default"
                            >
                              <EyeOff className="h-3 w-3" aria-hidden />
                              Anonim
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Bunu diğer kullanıcılar göremez.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>

                    <span
                      className="shrink-0 whitespace-nowrap inline-flex items-center justify-center min-w-[1.75rem] text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 tabular-nums bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      aria-label={`${t.entryCount} entry`}
                    >
                      {t.entryCount}
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

function SkeletonList() {
  return (
    <ul className="py-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-start gap-3 py-3 -mx-2 px-2"
        >
          <Skeleton className="h-4 flex-1 max-w-[70%]" />
          <Skeleton className="h-5 w-8 rounded-full shrink-0" />
        </li>
      ))}
    </ul>
  )
}
