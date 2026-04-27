"use client"

import { useState, useEffect, useCallback, useRef, useMemo, useLayoutEffect, type UIEvent } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import { ArrowLeft, MessageSquare, Send } from "lucide-react"
import { getApiUrl, apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageBodyEditor } from "@/components/message-body-editor"
import { formatTurkeyDateTime } from "@/lib/turkey-datetime"
import { TURKEY_TIMEZONE } from "@/lib/turkey-datetime"
import { topicHref } from "@/lib/topic-href"
import { cn } from "@/lib/utils"
import { getAuth } from "@/lib/auth"
import { listAllMessageImages, parseMessageToSegments } from "@/lib/messaging-markdown"
import { toast } from "sonner"
import {
  EntryImageLightboxDialog,
  type ImageLightboxState,
} from "@/components/entry-image-lightbox-dialog"

export type MessageReference = {
  kind: string
  id: string
  title: string
  topicTitle?: string | null
  topicSlug?: string | null
  topicId?: string | null
  snippet?: string | null
}

export type ApiMessage = {
  id: string
  senderId: string
  senderDisplayName: string
  senderAvatar?: string | null
  recipientId: string
  recipientDisplayName: string
  recipientAvatar?: string | null
  content: string
  createdAtUtc: string
  readAtUtc?: string | null
  reference?: MessageReference | null
}

type ConversationItem = {
  otherUserId: string
  otherDisplayName: string
  otherAvatar?: string | null
  lastMessagePreview: string
  lastMessageAtUtc: string
  unreadCount: number
}

function topicLinkHref(ref: MessageReference) {
  return topicHref({
    id: ref.topicId ?? ref.id,
    slug: ref.topicSlug ?? undefined,
  })
}

function MessageReferenceBubbleBlock({
  refData,
  variant = "received",
}: {
  refData: MessageReference
  variant?: "sent" | "received"
}) {
  const sent = variant === "sent"
  const box = sent
    ? "border-primary-foreground/25 bg-primary-foreground/10"
    : "border-primary/25 bg-background/50"
  const sub = sent ? "text-primary-foreground/80 border-l-primary-foreground/40" : "text-muted-foreground border-l-primary/35"
  const link = sent
    ? "text-primary-foreground font-semibold hover:underline [overflow-wrap:anywhere]"
    : "font-semibold text-foreground hover:underline [overflow-wrap:anywhere]"
  const linkSmall = sent ? "text-primary-foreground/90 hover:underline" : "text-primary hover:underline"
  if (refData.kind === "entry") {
    return (
      <div className={cn("mb-1.5 rounded-lg border px-2.5 py-2 text-xs", box)}>
        {refData.topicTitle && (
          <Link href={topicLinkHref(refData)} className={link}>
            {refData.topicTitle}
          </Link>
        )}
        {refData.snippet && (
          <p className={cn("mt-1 line-clamp-3 border-l-2 pl-2 [overflow-wrap:anywhere]", sub)}>
            {refData.snippet}
          </p>
        )}
        <Link href={`/entry/${refData.id}`} className={cn("mt-1.5 inline text-[11px]", linkSmall)}>
          Entry sayfası →
        </Link>
      </div>
    )
  }
  if (refData.kind === "topic") {
    return (
      <div className={cn("mb-1.5 rounded-lg border px-2.5 py-2 text-xs", box)}>
        <Link
          href={topicLinkHref(refData)}
          className={cn(
            "inline-flex flex-wrap items-baseline gap-1.5 text-sm font-medium [overflow-wrap:anywhere] hover:underline",
            link,
          )}
        >
          <span
            className={cn("select-none font-normal", sent ? "text-primary-foreground/80" : "text-muted-foreground")}
            aria-hidden
          >
            #
          </span>
          <span>{refData.title}</span>
        </Link>
      </div>
    )
  }
  return null
}

function shouldCollapsePlainBody(plain: string) {
  if (plain.length > 500) return true
  if (plain.split(/\r?\n/).length > 6) return true
  return false
}

/** Sohbet balonu: satır-içi thumbnail. react-markdown kullanılmıyor; `parseMessageToSegments` ile img üretiliyor. */
const CHAT_IMG_THUMB_STYLES = cn(
  "inline-block h-[1.5em] w-auto max-w-[40px] object-cover object-center align-middle mx-1 cursor-pointer rounded-sm border border-gray-200/50",
  "shrink-0 min-h-0 min-w-0",
  /* Üst/ global img kurallarına karşı: boyut kilitli, block/width:100% etkisiz */
  "!inline-block !h-[1.5em] !w-auto !max-w-[40px] !max-h-[1.5em]",
)
const CHAT_IMG_THUMB_MINE = "!border-primary-foreground/40"

function ChatMessageContent({
  text,
  isMine,
  onImageClick,
}: {
  text: string
  isMine: boolean
  onImageClick: (imageIndex: number) => void
}) {
  const segments = useMemo(() => parseMessageToSegments(text), [text])
  const plainTextForCollapse = useMemo(
    () => segments.filter((s) => s.type === "text").map((s) => s.content).join(""),
    [segments],
  )
  const needCollapse = useMemo(
    () => shouldCollapsePlainBody(plainTextForCollapse),
    [plainTextForCollapse],
  )
  const [expanded, setExpanded] = useState(false)
  const textClass = cn(
    "whitespace-pre-wrap break-words text-[15px] leading-relaxed [overflow-wrap:anywhere]",
    isMine && "text-primary-foreground",
  )

  const nodes = segments.map((seg, i) => {
    if (seg.type === "text") {
      return (
        <span key={`t-${i}`} className={textClass}>
          {seg.content}
        </span>
      )
    }
    return (
      <button
        key={`i-${i}-${seg.src}`}
        type="button"
        onClick={() => onImageClick(seg.index)}
        title="Büyüt"
        className="m-0 inline border-0 bg-transparent p-0 align-middle leading-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        aria-label="Görseli büyüt"
      >
        <img
          src={seg.src}
          alt={seg.alt}
          className={cn(CHAT_IMG_THUMB_STYLES, isMine && CHAT_IMG_THUMB_MINE)}
          loading="lazy"
          referrerPolicy="no-referrer"
          draggable={false}
        />
      </button>
    )
  })

  return (
    <div className="min-w-0 max-w-full text-left [overflow-wrap:anywhere] [&_img]:!inline-block [&_img]:!max-h-[1.5em] [&_img]:!max-w-[40px]">
      {needCollapse ? (
        <div>
          <div className={cn(!expanded && "line-clamp-5", expanded && "line-clamp-none")}>{nodes}</div>
          <button
            type="button"
            className={cn(
              "mt-1.5 text-xs font-medium underline-offset-2 hover:underline",
              isMine ? "text-primary-foreground/90" : "text-primary",
            )}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Daha az göster" : "Devamını oku"}
          </button>
        </div>
      ) : (
        <div>{nodes}</div>
      )}
    </div>
  )
}

function formatMessageMeta(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIMEZONE,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function dispatchMessagesRefresh() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event("tespit-messages-refresh"))
}

function UserAvatar({ name, avatar, className }: { name: string; avatar?: string | null; className?: string }) {
  const display = (name || "?").trim() || "?"
  if (avatar?.startsWith("http")) {
    return (
      <img
        src={avatar}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          "h-10 w-10 rounded-full object-cover border border-border shrink-0",
          className,
        )}
      />
    )
  }
  if (avatar) {
    return (
      <span
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-xl border border-border shrink-0",
          className,
        )}
      >
        {avatar}
      </span>
    )
  }
  return (
    <Avatar className={cn("h-10 w-10 shrink-0", className)}>
      <AvatarFallback className="text-xs font-medium">{display.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

function makeTempId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function MessagesInboxView() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const auth = getAuth()
  const myId = auth?.user?.id

  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [conversationsLoading, setConversationsLoading] = useState(true)
  const [conversationsError, setConversationsError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [thread, setThread] = useState<ApiMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadError, setThreadError] = useState<string | null>(null)
  const [mobileThread, setMobileThread] = useState(false)

  const [draft, setDraft] = useState("")
  /** Gönderimden sonra TipTap’i kesin boşaltmak için remount (key) */
  const [composerKey, setComposerKey] = useState(0)
  const [sending, setSending] = useState(false)
  const [imageLightbox, setImageLightbox] = useState<ImageLightboxState>(null)
  const [threadPeerFallback, setThreadPeerFallback] = useState<{
    otherUserId: string
    otherDisplayName: string
    otherAvatar?: string | null
  } | null>(null)
  const threadScrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const lastChatWithHandled = useRef<string | null>(null)

  const openChatImageLightbox = useCallback((messageText: string, imageIndex: number) => {
    const images = listAllMessageImages(messageText)
    if (images.length === 0) return
    setImageLightbox({
      images,
      currentIndex: Math.min(Math.max(0, imageIndex), images.length - 1),
    })
  }, [])

  const selectedPeer = useMemo(() => {
    if (!selectedId) return null
    const inList = conversations.find((c) => c.otherUserId === selectedId)
    if (inList) return inList
    if (threadPeerFallback?.otherUserId === selectedId) {
      return {
        otherUserId: threadPeerFallback.otherUserId,
        otherDisplayName: threadPeerFallback.otherDisplayName,
        otherAvatar: threadPeerFallback.otherAvatar,
        lastMessagePreview: "",
        lastMessageAtUtc: new Date(0).toISOString(),
        unreadCount: 0,
      } satisfies ConversationItem
    }
    return null
  }, [conversations, selectedId, threadPeerFallback])

  const loadConversations = useCallback(async () => {
    if (!myId) return
    setConversationsLoading(true)
    setConversationsError(null)
    try {
      const res = await apiFetch(getApiUrl("api/Messages/conversations"))
      if (res.status === 401) {
        setConversationsError("Oturum gerekli.")
        setConversations([])
        return
      }
      if (!res.ok) {
        setConversationsError("Sohbetler yüklenemedi.")
        setConversations([])
        return
      }
      const data = (await res.json()) as Array<{
        otherUserId: string
        otherDisplayName: string
        otherAvatar?: string | null
        lastMessagePreview: string
        lastMessageAtUtc: string
        unreadCount: number
      }>
      setConversations(
        (data ?? []).map((c) => ({
          otherUserId: c.otherUserId,
          otherDisplayName: c.otherDisplayName,
          otherAvatar: c.otherAvatar,
          lastMessagePreview: c.lastMessagePreview,
          lastMessageAtUtc: c.lastMessageAtUtc,
          unreadCount: c.unreadCount,
        })),
      )
    } catch {
      setConversationsError("Sohbetler yüklenemedi.")
      setConversations([])
    } finally {
      setConversationsLoading(false)
    }
  }, [myId])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!selectedId) return
    if (conversations.some((c) => c.otherUserId === selectedId)) {
      setThreadPeerFallback(null)
    }
  }, [conversations, selectedId])

  const scrollToEnd = useCallback(() => {
    const el = threadScrollRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
      return
    }
    endRef.current?.scrollIntoView({ block: "end" })
  }, [])

  /** Sohbet açıldıktan sonra ve yeni satır (optimistic dahil) eklendiğinde son mesaja in. */
  useLayoutEffect(() => {
    if (!selectedId || threadLoading) return
    requestAnimationFrame(() => {
      scrollToEnd()
    })
  }, [thread, threadLoading, selectedId, scrollToEnd])

  /**
   * API şu an tüm thread’i tek yanıtta döndürüyor; ileride `before` / sayfalama
   * eklendiğinde bu konteynerde yukarı kaydırma eşiğinde eski mesajlar yüklenebilir.
   */
  const handleThreadScroll = useCallback((_e: UIEvent<HTMLDivElement>) => {
    // const t = e.currentTarget
    // if (t.scrollTop < 80 && hasOlderMessages) void loadOlderMessages()
  }, [])

  const markThreadRead = useCallback(
    async (otherUserId: string) => {
      try {
        const res = await apiFetch(getApiUrl(`api/Messages/thread/${otherUserId}/read`), { method: "PUT" })
        if (res.ok) {
          setConversations((prev) =>
            prev.map((c) => (c.otherUserId === otherUserId ? { ...c, unreadCount: 0 } : c)),
          )
          dispatchMessagesRefresh()
        }
      } catch {
        // sessiz: rozet hafif sapabilir, kritik değil
      }
    },
    [],
  )

  const openThread = useCallback(
    async (otherUserId: string) => {
      if (!myId) return
      setSelectedId(otherUserId)
      setThreadError(null)
      setThreadLoading(true)
      setThread([])
      setMobileThread(true)
      try {
        const res = await apiFetch(getApiUrl(`api/Messages/thread/${otherUserId}`))
        if (res.status === 401) {
          setThreadError("Oturum gerekli.")
          return
        }
        if (res.status === 404) {
          setThreadError("Kullanıcı bulunamadı.")
          return
        }
        if (!res.ok) {
          setThreadError("Sohbet yüklenemedi.")
          return
        }
        const items = (await res.json()) as ApiMessage[] | unknown
        const list = Array.isArray(items) ? items : []
        setThread(list)

        const inList = conversations.some((c) => c.otherUserId === otherUserId)
        if (inList) {
          setThreadPeerFallback(null)
        } else if (list.length > 0) {
          const first = list[0] as ApiMessage
          const name =
            first.senderId === otherUserId ? first.senderDisplayName : first.recipientDisplayName
          const av = first.senderId === otherUserId ? first.senderAvatar : first.recipientAvatar
          setThreadPeerFallback({
            otherUserId,
            otherDisplayName: name,
            otherAvatar: av,
          })
        } else {
          const ur = await apiFetch(getApiUrl(`api/Users/${otherUserId}`))
          if (ur.ok) {
            const u: { nickname?: string; avatar?: string | null } = await ur.json()
            setThreadPeerFallback({
              otherUserId,
              otherDisplayName:
                typeof u.nickname === "string" && u.nickname.trim() ? u.nickname : "Kullanıcı",
              otherAvatar: u.avatar ?? null,
            })
          } else {
            setThreadPeerFallback({
              otherUserId,
              otherDisplayName: "Kullanıcı",
              otherAvatar: null,
            })
          }
        }
        void markThreadRead(otherUserId)
      } catch {
        setThreadError("Sohbet yüklenemedi.")
      } finally {
        setThreadLoading(false)
      }
    },
    [myId, markThreadRead, conversations],
  )

  useEffect(() => {
    const raw = searchParams.get("chatWith")
    if (!raw) {
      lastChatWithHandled.current = null
      return
    }
    if (!myId || raw === myId) return
    if (lastChatWithHandled.current === raw) return
    lastChatWithHandled.current = raw
    void openThread(raw).then(() => {
      router.replace("/mesajlar", { scroll: false })
    })
  }, [searchParams, myId, openThread, router])

  const handleBack = () => {
    setMobileThread(false)
    setSelectedId(null)
  }

  const sendMessage = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault()
      if (!myId || !selectedId) return
      const trimmed = draft.trim()
      if (!trimmed || sending) return
      setSending(true)
      const a = getAuth()
      const displayName = a?.user?.nickname ?? a?.user?.name ?? "ben"
      const tempId = makeTempId()
      const nowIso = new Date().toISOString()
      const optimistic: ApiMessage = {
        id: tempId,
        senderId: myId,
        senderDisplayName: displayName,
        senderAvatar: a?.user?.avatar,
        recipientId: selectedId,
        recipientDisplayName: selectedPeer?.otherDisplayName ?? "",
        recipientAvatar: selectedPeer?.otherAvatar,
        content: trimmed,
        createdAtUtc: nowIso,
        readAtUtc: null,
        reference: null,
      }
      setThread((prev) => [...prev, optimistic])
      setDraft("")
      setComposerKey((k) => k + 1)

      try {
        const res = await apiFetch(getApiUrl("api/Messages"), {
          method: "POST",
          body: JSON.stringify({
            recipientId: selectedId,
            content: trimmed,
          }),
        })
        if (res.status === 403) {
          setThread((prev) => prev.filter((m) => m.id !== tempId))
          setDraft(trimmed)
          await res.json().catch(() => ({}))
          toast.error("Bu yazara mesaj gönderemezsiniz")
          return
        }
        if (!res.ok) {
          setThread((prev) => prev.filter((m) => m.id !== tempId))
          setDraft(trimmed)
          const data = (await res.json().catch(() => ({}))) as { message?: string }
          toast.error(data?.message ?? "Mesaj gönderilemedi.")
          return
        }
        const saved = (await res.json()) as ApiMessage
        setThread((prev) => prev.map((m) => (m.id === tempId ? saved : m)))
        setConversations((prev) => {
          const i = prev.findIndex((c) => c.otherUserId === selectedId)
          const lastAt = saved.createdAtUtc
          const preview =
            saved.content.length > 200 ? `${saved.content.slice(0, 197).trimEnd()}…` : saved.content
          if (i < 0) {
            return [
              {
                otherUserId: selectedId,
                otherDisplayName: selectedPeer?.otherDisplayName ?? "Kullanıcı",
                otherAvatar: selectedPeer?.otherAvatar,
                lastMessagePreview: preview,
                lastMessageAtUtc: lastAt,
                unreadCount: 0,
              },
              ...prev,
            ]
          }
          const copy = [...prev]
          const cur = { ...copy[i] }
          copy.splice(i, 1)
          return [
            {
              ...cur,
              lastMessagePreview: preview,
              lastMessageAtUtc: lastAt,
            },
            ...copy,
          ]
        })
        dispatchMessagesRefresh()
      } catch {
        setThread((prev) => prev.filter((m) => m.id !== tempId))
        setDraft(trimmed)
        toast.error("Mesaj gönderilemedi.")
      } finally {
        setSending(false)
      }
    },
    [draft, myId, selectedId, selectedPeer, sending],
  )

  if (!myId) {
    return <div className="p-6 text-center text-sm text-muted-foreground">Oturum yok.</div>
  }

  return (
    <div
      className={cn(
        "mx-auto flex h-full min-h-0 w-full max-w-[88rem] flex-col overflow-hidden px-3 py-2 sm:px-4 sm:py-3",
      )}
    >
      <h1 className="shrink-0 text-xl font-bold tracking-tight text-foreground sm:text-2xl">Sohbetler</h1>

      <div
        className={cn(
          "mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
          "lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]",
        )}
      >
        <aside
          className={cn(
            "flex h-full w-full min-h-0 max-w-full shrink-0 flex-col overflow-hidden border-b border-border bg-muted/10",
            "lg:max-w-none lg:min-w-[20rem] lg:min-h-0 lg:w-full",
            "lg:border-b-0 lg:border-r",
            mobileThread && "hidden lg:flex",
          )}
        >
          {conversationsLoading && (
            <div className="flex flex-1 min-h-0 items-center justify-center p-4 text-sm text-muted-foreground">
              Yükleniyor…
            </div>
          )}
          {conversationsError && (
            <div className="flex flex-1 min-h-0 items-center justify-center p-4 text-center text-sm text-destructive">
              {conversationsError}
            </div>
          )}
          {!conversationsLoading && !conversationsError && conversations.length === 0 && (
            <div className="flex flex-1 min-h-0 items-center justify-center p-6 text-center text-sm text-muted-foreground">
              Henüz sohbet yok. Profil veya entry üzerinden mesaj göndererek başlayabilirsin.
            </div>
          )}
          {!conversationsLoading && !conversationsError && conversations.length > 0 && (
            <ul className="min-h-0 flex-1 list-none overflow-y-auto overscroll-contain [scrollbar-gutter:stable] divide-y divide-border/80 p-0 m-0">
              {conversations.map((c) => {
                const isSel = c.otherUserId === selectedId
                return (
                  <li key={c.otherUserId}>
                    <button
                      type="button"
                      onClick={() => void openThread(c.otherUserId)}
                      className={cn(
                        "w-full text-left px-3 py-3 sm:px-4 flex gap-3 transition-colors",
                        "hover:bg-muted/60",
                        c.unreadCount > 0 && "bg-primary/5 border-l-2 border-l-primary pl-[10px] sm:pl-[14px]",
                        isSel && "bg-muted/50",
                      )}
                    >
                      <UserAvatar name={c.otherDisplayName} avatar={c.otherAvatar} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={cn(
                              "text-sm truncate",
                              c.unreadCount > 0
                                ? "font-semibold text-foreground"
                                : "font-medium text-foreground",
                            )}
                          >
                            {c.otherDisplayName}
                          </p>
                          {c.unreadCount > 0 && (
                            <span
                              className="shrink-0 rounded-full bg-primary px-1.5 min-w-5 text-center text-[11px] font-bold text-primary-foreground"
                            >
                              {c.unreadCount > 99 ? "99+" : c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "text-xs line-clamp-2 mt-0.5 [overflow-wrap:anywhere]",
                            c.unreadCount > 0
                              ? "text-foreground/90 font-medium"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.lastMessagePreview}
                        </p>
                        <p className="mt-0.5 text-[9px] tabular-nums text-muted-foreground/60 sm:text-[10px]">
                          {formatTurkeyDateTime(c.lastMessageAtUtc)}
                        </p>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </aside>

        <section
          className={cn(
            "flex h-full min-h-0 min-h-[45dvh] flex-1 flex-col overflow-hidden bg-background",
            "lg:min-h-0",
            !mobileThread && "hidden lg:flex",
          )}
        >
          {!selectedId && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6 text-center text-muted-foreground min-h-0">
              <MessageSquare className="h-10 w-10 opacity-30" aria-hidden />
            </div>
          )}

          {selectedId && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <header className="flex shrink-0 items-center gap-2 border-b border-border/80 bg-muted/20 px-2 py-2 sm:px-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 lg:hidden"
                  onClick={handleBack}
                  aria-label="Sohbet listesine dön"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                {selectedPeer && (
                  <Link
                    href={`/user/${selectedPeer.otherUserId}`}
                    className="flex min-w-0 items-center gap-2 flex-1"
                  >
                    <UserAvatar name={selectedPeer.otherDisplayName} avatar={selectedPeer.otherAvatar} className="h-9 w-9" />
                    <div className="min-w-0 text-left">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedPeer.otherDisplayName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">profil</p>
                    </div>
                  </Link>
                )}
              </header>

              {threadLoading && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-8 text-sm text-muted-foreground">
                  Açılıyor…
                </div>
              )}

              {threadError && !threadLoading && (
                <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden p-6 text-center text-sm text-destructive">
                  {threadError}
                </div>
              )}

              {!threadLoading && !threadError && (
                <div
                  ref={threadScrollRef}
                  onScroll={handleThreadScroll}
                  className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-4 [scrollbar-gutter:stable]"
                >
                  {thread.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Bu sohbette henüz mesaj yok.</p>
                  )}
                  {thread.map((m) => {
                    const isMine = m.senderId === myId
                    return (
                      <div
                        key={m.id}
                        className={cn("flex w-full", isMine ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[min(100%,32rem)] rounded-2xl px-3 py-2.5 text-sm shadow-sm",
                            isMine
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm border border-border/50",
                          )}
                        >
                          {m.reference && (
                            <MessageReferenceBubbleBlock
                              refData={m.reference}
                              variant={isMine ? "sent" : "received"}
                            />
                          )}
                          <ChatMessageContent
                            text={m.content}
                            isMine={isMine}
                            onImageClick={(idx) => openChatImageLightbox(m.content, idx)}
                          />
                          <p
                            className={cn(
                              "text-[10px] mt-1 tabular-nums",
                              isMine ? "text-primary-foreground/75" : "text-muted-foreground",
                            )}
                          >
                            {formatMessageMeta(m.createdAtUtc)}
                            {m.id.startsWith("pending-") && " · gönderiliyor…"}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={endRef} className="h-px" aria-hidden />
                </div>
              )}

              <form
                onSubmit={sendMessage}
                className="shrink-0 border-0 bg-background/95 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-sm sm:px-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-2"
              >
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <MessageBodyEditor
                      key={`${selectedId}-composer-${composerKey}`}
                      variant="chat"
                      value={draft}
                      onChange={setDraft}
                      disabled={sending}
                      placeholder="Mesaj yaz…"
                    />
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    title="Gönder"
                    aria-label="Gönder"
                    className="h-9 w-9 shrink-0 rounded-full"
                    disabled={sending || !draft.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>

      <EntryImageLightboxDialog
        value={imageLightbox}
        onOpenChange={(o) => {
          if (!o) setImageLightbox(null)
        }}
        onIndexChange={(idx) =>
          setImageLightbox((prev) => (prev ? { ...prev, currentIndex: idx } : null))
        }
        zOverlayClassName="z-[200]"
        zContentClassName="z-[200]"
      />
    </div>
  )
}
