"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Moon, Sun, Menu, X, Hash, User } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SearchTopic = { id: string; title: string }
type SearchUser = { id: string; name: string }

interface NavbarProps {
  isLoggedIn: boolean
  user?: {
    name: string
    email: string
    avatar?: string
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
}: NavbarProps) {
  const { theme, setTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [searchResults, setSearchResults] = useState<{ topics: SearchTopic[]; users: SearchUser[] }>({ topics: [], users: [] })
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isSearchLoading, setIsSearchLoading] = useState(false)
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
      const res = await fetch(getApiUrl(`api/Search?q=${encodeURIComponent(q)}`))
      const data = await res.json().catch(() => ({}))
      setSearchResults({
        topics: (data.topics ?? []).map((t: { id: string; title: string }) => ({ id: String(t.id), title: t.title ?? "" })),
        users: (data.users ?? []).map((u: { id: string; name: string }) => ({ id: String(u.id), name: u.name ?? "" })),
      })
    } catch {
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left: Logo + Mobile Menu */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 -ml-1.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <button
            onClick={onHomeClick}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Tespit Sözlük
            </span>
          </button>
        </div>

        {/* Center: Search + All Topics */}
        <div className="hidden md:flex flex-1 max-w-xl mx-4 lg:mx-8 items-center gap-3">
          <div ref={desktopSearchRef} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="başlık veya kişi ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => debouncedQuery.length >= 2 && setIsSearchOpen(true)}
              className="w-full h-9 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
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
                            <span className="truncate">{u.name || "İsimsiz"}</span>
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
            variant="ghost"
            size="sm"
            onClick={onAllTopicsClick}
            className="whitespace-nowrap text-muted-foreground hover:text-foreground h-9 px-3 text-sm shrink-0"
          >
            Tüm Başlıklar
          </Button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Tema değiştir</span>
          </Button>

          {isLoggedIn && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-secondary text-foreground text-xs font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 px-2 py-1.5">
                  <p className="text-sm font-medium leading-none text-foreground">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onProfileClick} className="cursor-pointer">
                  Profilim
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer">Ayarlar</DropdownMenuItem>
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
                className="h-8 px-3 text-sm bg-foreground text-background hover:bg-foreground/90"
              >
                Kayıt Ol
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Search */}
      <div className="md:hidden px-4 pb-3">
        <div ref={mobileSearchRef} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
          <input
            type="text"
            placeholder="başlık veya kişi ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => debouncedQuery.length >= 2 && setIsSearchOpen(true)}
            className="w-full h-9 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
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
                          <span className="truncate">{u.name || "İsimsiz"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
