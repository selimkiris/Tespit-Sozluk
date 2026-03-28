"use client"

import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react"
import Link from "next/link"
import { Search, Menu, X, Hash, User, Bell, Settings, ShieldAlert, Info } from "lucide-react"
import DOMPurify from "isomorphic-dompurify"
import { getApiUrl, apiFetch } from "@/lib/api"
import {
  mapNotificationFromApi,
  isHtmlNotificationType,
  NotificationType,
  formatNotificationTime,
  type NotificationItem,
} from "@/lib/notification-types"
import { renderNotificationCopy } from "@/lib/notification-message"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { SettingsDialog } from "@/components/settings-dialog"
import { toast } from "sonner"

const NAVBAR_LIST_FETCH_ERROR =
  "Tüh! Verileri yolda düşürdük galiba... Sayfayı yenileyip tekrar dener misin?"

type SearchTopic = { id: string; title: string }
type SearchUser = { id: string; name: string }

interface NavbarProps {
  isLoggedIn: boolean
  user?: {
    name: string
    email: string
    avatar?: string | null
    hasChangedUsername?: boolean
    role?: string
  }
  onLoginClick: () => void
  onRegisterClick: () => void
  onLogout: () => void
  onProfileClick: () => void
  onMenuClick: () => void
  isMobileMenuOpen: boolean
  onHomeClick: () => void
  onAllTopicsClick: () => void
  onTopicSelect?: (topicId: string) => void
  onUserSelect?: (userId: string, userName?: string) => void
  onUserUpdate?: (updates: { avatar?: string; name?: string; nickname?: string }) => void
  accentColor?: string
}

const ACCENT_RGB: Record<string, string> = {
  "#f28f35": "242,143,53",
  "#55d197": "85,209,151",
  "#2c64f6": "44,100,246",
}

const NAVBAR_BORDER_ALPHA: Record<string, number> = {
  "#f28f35": 0.15,
  "#55d197": 0.15,
  "#2c64f6": 0.3,
}

const NAVBAR_SHADOW_ALPHA: Record<string, number> = {
  "#f28f35": 0.02,
  "#55d197": 0.02,
  "#2c64f6": 0.05,
}

export function Navbar({
  isLoggedIn,
  user,
  onLoginClick,
  onRegisterClick,
  onLogout,
  onProfileClick,
  onMenuClick,
  isMobileMenuOpen,
  onHomeClick,
  onAllTopicsClick,
  onTopicSelect,
  onUserSelect,
  onUserUpdate,
  accentColor = "#2c64f6",
}: NavbarProps) {
  const accentRgb = ACCENT_RGB[accentColor] ?? "44,100,246"
  const navbarBorderAlpha = NAVBAR_BORDER_ALPHA[accentColor] ?? 0.3
  const navbarShadowAlpha = NAVBAR_SHADOW_ALPHA[accentColor] ?? 0.05
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ topics: SearchTopic[]; users: SearchUser[] }>({ topics: [], users: [] })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [adminUnreadReports, setAdminUnreadReports] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const desktopSearchRef = useRef<HTMLDivElement>(null)
  const mobileSearchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchSearch = useCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults({ topics: [], users: [] })
      return
    }
    setIsSearchLoading(true)
    try {
      const res = await apiFetch(getApiUrl(`api/Search?q=${encodeURIComponent(q)}`))
      if (!res.ok) {
        toast.error(NAVBAR_LIST_FETCH_ERROR)
        setSearchResults({ topics: [], users: [] })
        return
      }
      const data = await res.json().catch(() => ({}))
      setSearchResults({
        topics: (data.topics ?? []).map((t: { id: string; title: string }) => ({ id: String(t.id), title: t.title ?? "" })),
        users: (data.users ?? []).map((u: { id: string; name: string }) => ({ id: String(u.id), name: u.name ?? "" })),
      })
    } catch {
      toast.error(NAVBAR_LIST_FETCH_ERROR)
      setSearchResults({ topics: [], users: [] })
    } finally {
      setIsSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      fetchSearch(debouncedQuery)
      setIsSearchOpen(true)
    } else {
      setSearchResults({ topics: [], users: [] })
      setIsSearchOpen(false)
    }
  }, [debouncedQuery, fetchSearch])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const inDesktop = desktopSearchRef.current?.contains(target)
      const inMobile = mobileSearchRef.current?.contains(target)
      if (!inDesktop && !inMobile) setIsSearchOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleTopicClick = (topicId: string) => {
    onTopicSelect?.(topicId)
    setSearchQuery("")
    setIsSearchOpen(false)
  }

  const handleUserClick = (userId: string, userName: string) => {
    onUserSelect?.(userId, userName)
    setSearchQuery("")
    setIsSearchOpen(false)
  }

  const hasResults = searchResults.topics.length > 0 || searchResults.users.length > 0

  const fetchUnreadCount = useCallback(async () => {
    if (!isLoggedIn) return
    try {
      const res = await apiFetch(getApiUrl("api/Notifications/unread-count"))
      if (res.ok) {
        const n = await res.json()
        setUnreadCount(typeof n === "number" ? n : 0)
      }
    } catch {
      setUnreadCount(0)
    }
  }, [isLoggedIn])

  const fetchAdminUnreadReports = useCallback(async () => {
    if (!isLoggedIn || user?.role !== "Admin") return
    try {
      const res = await apiFetch(getApiUrl("api/Admin/reports/unread-count"))
      if (res.ok) {
        const n = await res.json()
        setAdminUnreadReports(typeof n === "number" ? n : 0)
      }
    } catch {
      setAdminUnreadReports(0)
    }
  }, [isLoggedIn, user?.role])

  const fetchNotifications = useCallback(async () => {
    if (!isLoggedIn) return
    setNotificationsLoading(true)
    try {
      const res = await apiFetch(getApiUrl("api/Notifications"))
      if (!res.ok) {
        toast.error(NAVBAR_LIST_FETCH_ERROR)
        setNotifications([])
        return
      }
      const data = await res.json()
      setNotifications(
        Array.isArray(data)
          ? (data as unknown[])
              .map(mapNotificationFromApi)
              .filter((x): x is NotificationItem => x != null)
          : []
      )
    } catch {
      toast.error(NAVBAR_LIST_FETCH_ERROR)
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (isLoggedIn) fetchUnreadCount()
    else setUnreadCount(0)
  }, [isLoggedIn, fetchUnreadCount])

  useEffect(() => {
    if (isLoggedIn && user?.role === "Admin") fetchAdminUnreadReports()
    else setAdminUnreadReports(0)
  }, [isLoggedIn, user?.role, fetchAdminUnreadReports])

  const markAllNotificationsReadAndRefresh = useCallback(async () => {
    if (!isLoggedIn) return
    try {
      const res = await apiFetch(getApiUrl("api/Notifications/mark-all-read"), {
        method: "PUT",
      })
      if (res.ok) setUnreadCount(0)
    } catch {
      // ignore
    }
    await fetchNotifications()
  }, [isLoggedIn, fetchNotifications])

  const handleNotificationsOpenChange = useCallback(
    (open: boolean) => {
      setIsNotificationsOpen(open)
      if (open && isLoggedIn) void markAllNotificationsReadAndRefresh()
    },
    [isLoggedIn, markAllNotificationsReadAndRefresh]
  )

  const handleMarkAsRead = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(getApiUrl(`api/Notifications/${id}/read`), {
        method: "PUT",
      })
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
      }
    } catch {
      // ignore
    }
  }, [])

  const closeNotificationsMenu = useCallback(() => {
    setIsNotificationsOpen(false)
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex flex-col border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{
        backgroundColor: "#252728",
        borderBottomColor: `rgba(${accentRgb},${navbarBorderAlpha})`,
        boxShadow: `0 4px 15px -5px rgba(${accentRgb},${navbarShadowAlpha})`,
        transition: "border-bottom-color 0.4s ease, box-shadow 0.4s ease",
      }}
    >
      {/* Ana toolbar: h-14 = 3.5rem (56px) */}
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Logo + Mobile Menu */}
        <div className="flex items-center gap-3 self-stretch">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button
            onClick={onHomeClick}
            className="flex h-full items-center hover:opacity-80 transition-opacity ml-9 lg:ml-10"
          >
            <span className="inline-flex h-full max-h-full items-center dark:invert">
              <img
                src="/marka.svg"
                alt="Tespit Sözlük"
                className="h-11 w-auto"
              />
            </span>
          </button>
        </div>

        {/* Center: Search + All Topics */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4 lg:mx-8 items-center gap-3">
          <div ref={desktopSearchRef} className="relative flex-1 rounded-lg border border-transparent focus-within:border-[#2c64f6] focus-within:ring-1 focus-within:ring-[#2c64f6] transition-all duration-200">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="başlık veya kişi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => debouncedQuery.length >= 2 && setIsSearchOpen(true)}
              className="w-full h-9 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all"
            />
            {isSearchOpen && debouncedQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-popover border border-border rounded-lg shadow-lg z-[100] max-h-80 overflow-y-auto">
                {isSearchLoading ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>
                ) : !hasResults ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">Sonuç bulunamadı</div>
                ) : (
                  <div className="space-y-1">
                    {searchResults.topics.length > 0 && (
                      <div className="px-2 pt-1">
                        <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Başlıklar</p>
                        {searchResults.topics.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => handleTopicClick(t.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-accent transition-colors"
                          >
                            <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{t.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {searchResults.users.length > 0 && (
                      <div className="px-2 pt-1">
                        <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Kişiler</p>
                        {searchResults.users.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => handleUserClick(u.id, u.name || "İsimsiz")}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-accent transition-colors"
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap inline-block">{u.name || "İsimsiz"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAllTopicsClick}
            className="whitespace-nowrap shrink-0 h-9 px-3 text-sm font-medium"
          >
            Tüm Başlıklar
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isLoggedIn && user?.role !== "Admin" && (
            <Popover open={isNotificationsOpen} onOpenChange={handleNotificationsOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-[#3a3b3c] rounded-full transition-colors duration-200"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && adminUnreadReports === 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground px-1">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                  {adminUnreadReports > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white px-1 animate-pulse">
                      {adminUnreadReports > 99 ? "99+" : adminUnreadReports}
                    </span>
                  )}
                  <span className="sr-only">Bildirimler</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="border-b border-border px-3 py-2">
                  <p className="font-medium text-sm text-foreground">Bildirimler</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notificationsLoading ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">Bildirim yok</div>
                  ) : (
                    notifications.map((n) => {
                      const isHtmlType = isHtmlNotificationType(n.type)
                      const timeLabel = formatNotificationTime(n.createdAt)
                      const timeRow =
                        timeLabel !== "" ? (
                          <p className="mt-1 w-full text-right text-[11px] leading-none tabular-nums text-muted-foreground/70">
                            {timeLabel}
                          </p>
                        ) : null

                      if (isHtmlType) {
                        const badgeConfig = {
                          OfficialWarning: {
                            bg: "bg-amber-500/15 border-amber-500/25",
                            text: "text-amber-600 dark:text-amber-400",
                            dot: "bg-amber-500",
                            unreadBg: "bg-amber-500/5",
                            icon: <ShieldAlert className="h-2.5 w-2.5" />,
                            label: "RESMİ UYARI",
                          },
                          AdminMessage: {
                            bg: "bg-[#323336] border border-[#3a3b3c]",
                            text: "text-[#e4e6eb] font-semibold",
                            dot: "bg-[#2c64f6]",
                            unreadBg: "",
                            icon: <ShieldAlert className="h-2.5 w-2.5" />,
                            label: "YÖNETİM MESAJI",
                          },
                          SystemAlert: {
                            bg: "bg-sky-500/15 border-sky-500/25",
                            text: "text-sky-600 dark:text-sky-400",
                            dot: "bg-sky-500",
                            unreadBg: "bg-sky-500/5",
                            icon: <ShieldAlert className="h-2.5 w-2.5" />,
                            label: "SİSTEM BİLDİRİMİ",
                          },
                        } as const
                        const cfg = badgeConfig[n.type as keyof typeof badgeConfig]
                        const isOfficialWarning = n.type === NotificationType.OfficialWarning
                        const isAdminMessage = n.type === NotificationType.AdminMessage
                        const htmlBodyClass =
                          "text-xs leading-relaxed [&_strong]:font-semibold [&_p]:mb-1 [&_p:last-child]:mb-0 " +
                          (isAdminMessage
                            ? "text-[#b0b3b8] [&_*]:!text-[#b0b3b8] [&_p.font-bold]:!text-[#2c64f6] [&_p.font-bold]:!font-semibold [&_a]:!text-[#2c64f6] [&_a]:underline [&_a:hover]:!text-[#4d7ef7] [&_.admin-message]:!bg-transparent [&_.admin-message]:!border-0 [&_.admin-message]:!border-l-0 [&_.admin-message]:!p-0 [&_.admin-message]:!rounded-none"
                            : "text-foreground [&_a]:text-blue-500 dark:[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-400 [&_strong]:text-foreground")

                        const timeRowForHtml =
                          isAdminMessage && timeLabel !== "" ? (
                            <p className="mt-1 w-full text-right text-[11px] leading-none tabular-nums text-[#8a8d91]/70">
                              {timeLabel}
                            </p>
                          ) : (
                            timeRow
                          )

                        return (
                          <div
                            key={n.id}
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-1 px-3 py-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                              isAdminMessage
                                ? `${!n.isRead ? "bg-[#313235]" : "bg-[#2a2b2e]"} border-[#3a3b3c] hover:bg-[#353639]`
                                : `hover:bg-accent border-border ${!n.isRead ? cfg.unreadBg : ""}`
                            } ${isOfficialWarning ? "relative" : ""}`}
                          >
                            {!isOfficialWarning && (
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text} border font-semibold tracking-wide`}>
                                  {cfg.icon} {cfg.label}
                                </span>
                                {!n.isRead && <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot} shrink-0`} />}
                              </div>
                            )}
                            {isOfficialWarning && !n.isRead && (
                              <span
                                className={`absolute top-3 right-3 h-1.5 w-1.5 rounded-full ${cfg.dot} shrink-0 z-10`}
                                aria-hidden
                              />
                            )}
                            <div
                              className={htmlBodyClass}
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(n.message, {
                                  ALLOWED_TAGS: ["div", "p", "strong", "em", "a", "br", "span", "h4", "svg", "path"],
                                  ALLOWED_ATTR: [
                                    "href", "class", "target", "rel",
                                    "xmlns", "viewBox", "fill", "stroke",
                                    "stroke-width", "stroke-linecap", "stroke-linejoin",
                                    "d", "width", "height",
                                  ],
                                }),
                              }}
                            />
                            {timeRowForHtml}
                          </div>
                        )
                      }

                      const markReadOnLinkClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
                        closeNotificationsMenu()
                        e.stopPropagation()
                        if (!n.isRead) void handleMarkAsRead(n.id)
                      }

                      const userLinkClass =
                        "font-medium text-[#55d197] hover:underline underline-offset-2"
                      const inlineEntryLinkClass = "text-foreground font-bold hover:underline"

                      if (n.type === NotificationType.Follow) {
                        return (
                          <div
                            key={n.id}
                            role="presentation"
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-0.5 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                          >
                            <p className="text-sm text-foreground leading-snug">
                              {renderNotificationCopy({
                                notification: n,
                                variant: "follow",
                                userLinkClass,
                                inlineEntryLinkClass,
                                onLinkClick: markReadOnLinkClick,
                              })}
                            </p>
                            {timeRow}
                          </div>
                        )
                      }

                      if (n.type === NotificationType.Like) {
                        return (
                          <div
                            key={n.id}
                            role="presentation"
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-1 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                          >
                            <p className="text-sm text-foreground leading-snug">
                              {renderNotificationCopy({
                                notification: n,
                                variant: "like",
                                userLinkClass,
                                inlineEntryLinkClass,
                                onLinkClick: markReadOnLinkClick,
                              })}
                            </p>
                            {timeRow}
                          </div>
                        )
                      }

                      if (n.type === NotificationType.Dislike) {
                        return (
                          <div
                            key={n.id}
                            role="presentation"
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-1 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                          >
                            <p className="text-sm text-foreground leading-snug">
                              {renderNotificationCopy({
                                notification: n,
                                variant: "dislike",
                                userLinkClass,
                                inlineEntryLinkClass,
                                onLinkClick: markReadOnLinkClick,
                              })}
                            </p>
                            {timeRow}
                          </div>
                        )
                      }

                      if (n.type === NotificationType.Save) {
                        return (
                          <div
                            key={n.id}
                            role="presentation"
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-1 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                          >
                            <p className="text-sm text-foreground leading-snug">
                              {renderNotificationCopy({
                                notification: n,
                                variant: "save",
                                userLinkClass,
                                inlineEntryLinkClass,
                                onLinkClick: markReadOnLinkClick,
                              })}
                            </p>
                            {timeRow}
                          </div>
                        )
                      }

                      if (n.type === NotificationType.Mention) {
                        return (
                          <div
                            key={n.id}
                            role="presentation"
                            onClick={() => {
                              closeNotificationsMenu()
                              if (!n.isRead) void handleMarkAsRead(n.id)
                            }}
                            className={`w-full flex flex-col gap-0.5 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                          >
                            <p className="text-sm text-foreground leading-snug">
                              {renderNotificationCopy({
                                notification: n,
                                variant: "mention",
                                userLinkClass,
                                inlineEntryLinkClass,
                                onLinkClick: markReadOnLinkClick,
                              })}
                            </p>
                            {timeRow}
                          </div>
                        )
                      }

                      return (
                        <div
                          key={n.id}
                          role="presentation"
                          onClick={() => {
                            closeNotificationsMenu()
                            if (!n.isRead) void handleMarkAsRead(n.id)
                          }}
                          className={`w-full flex flex-col gap-0.5 px-3 py-2.5 text-left cursor-pointer hover:bg-accent transition-colors border-b border-border last:border-b-0 ${!n.isRead ? "bg-accent/50" : ""}`}
                        >
                          <p className="text-sm font-medium text-foreground max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap">{n.senderName}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                          {timeRow}
                        </div>
                      )
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  {user.avatar?.startsWith("http") ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full object-cover border border-border"
                    />
                  ) : user.avatar ? (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-2xl border border-border">
                      {user.avatar}
                    </span>
                  ) : (
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={undefined} alt={user.name} />
                      <AvatarFallback className="bg-secondary text-foreground text-xs font-medium">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 px-2 py-1.5">
                  <p className="text-sm font-medium leading-none text-foreground">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onProfileClick} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profilim
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowSettingsDialog(true)} className="cursor-pointer">
                  <Settings className="h-4 w-4 mr-2" />
                  Ayarlar
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/hakkimizda" className="flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Hakkımızda
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive">
                  Çıkış Yap
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoginClick}
                className="text-muted-foreground hover:text-foreground h-8 px-3 text-sm"
              >
                Giriş
              </Button>
              <Button
                size="sm"
                onClick={onRegisterClick}
                className="h-8 px-3 text-sm bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Kayıt Ol
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: arama + Tüm Başlıklar (tek satır — içerik için toplam yükseklik toolbar + ~3rem) */}
      <div className="md:hidden px-4 pb-3">
        <div className="flex items-center gap-2">
          <div ref={mobileSearchRef} className="relative flex-1 min-w-0 rounded-lg border border-transparent focus-within:border-[#2c64f6] focus-within:ring-1 focus-within:ring-[#2c64f6] transition-all duration-200 z-10">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
            <input
              type="text"
              placeholder="başlık veya kişi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => debouncedQuery.length >= 2 && setIsSearchOpen(true)}
              className="w-full h-9 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none transition-all relative z-0"
            />
            {isSearchOpen && debouncedQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1 py-2 bg-popover border border-border rounded-lg shadow-lg z-[100] max-h-80 overflow-y-auto">
              {isSearchLoading ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Yükleniyor...</div>
              ) : !hasResults ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">Sonuç bulunamadı</div>
              ) : (
                <div className="space-y-1">
                  {searchResults.topics.length > 0 && (
                    <div className="px-2 pt-1">
                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Başlıklar</p>
                      {searchResults.topics.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleTopicClick(t.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-accent transition-colors"
                        >
                          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchResults.users.length > 0 && (
                    <div className="px-2 pt-1">
                      <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Kişiler</p>
                      {searchResults.users.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => handleUserClick(u.id, u.name || "İsimsiz")}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md hover:bg-accent transition-colors"
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="max-w-[220px] overflow-hidden text-ellipsis whitespace-nowrap inline-block">{u.name || "İsimsiz"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAllTopicsClick}
            className="shrink-0 h-9 px-2.5 text-xs font-medium whitespace-nowrap"
          >
            Tüm Başlıklar
          </Button>
        </div>
      </div>

      {user && (
        <SettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          user={{
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            hasChangedUsername: user.hasChangedUsername,
          }}
          onUserUpdate={onUserUpdate}
        />
      )}
    </header>
  )
}
