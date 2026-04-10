"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, ChevronDown } from "lucide-react"
import { getApiUrl, apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Topic {
  id: string
  title: string
  entryCount: number
  authorId?: string
  authorName?: string
  authorUsername?: string
  authorAvatar?: string | null
  createdAt?: string
  isAnonymous?: boolean
  isTopicOwner?: boolean
  canManageTopic?: boolean
  isFollowedByCurrentUser?: boolean
}

interface TopicSidebarProps {
  topics?: Topic[]
  selectedTopicId?: string
  onTopicSelect: (topicId: string) => void
  onCreateTopic: () => void
  onAllTopicsClick?: () => void
  onTopicsLoaded?: (topics: Topic[]) => void
  isOpen: boolean
  onClose: () => void
  refreshTrigger?: number
  accentColor?: string
  /** true: sadece lg altı (hamburger menü) — masaüstünde sabit şerit gösterme (ör. profil sayfası) */
  mobileOnly?: boolean
}

const ACCENT_RGB: Record<string, string> = {
  "#f28f35": "242,143,53",
  "#55d197": "85,209,151",
  "#2c64f6": "44,100,246",
}

// Butona özgü deep-matte tonlar — navbar ve sidebar çizgileri bu tablodan etkilenmez
const BUTTON_COLOR: Record<string, string> = {
  "#f28f35": "#753a0a",
  "#55d197": "#155233",
  "#2c64f6": "#1f408e",
}

const BUTTON_HOVER_COLOR: Record<string, string> = {
  "#753a0a": "#8c460d",
  "#155233": "#1a663f",
  "#1f408e": "#254b9f",
}

const BUTTON_RGB: Record<string, string> = {
  "#753a0a": "117,58,10",
  "#155233": "21,82,51",
  "#1f408e": "31,64,142",
}

function mapApiTopic(apiTopic: {
  id: string
  title: string
  entryCount?: number
  authorId?: string
  authorName?: string
  authorUsername?: string
  authorAvatar?: string | null
  createdAt?: string
  isAnonymous?: boolean
  isTopicOwner?: boolean
  canManageTopic?: boolean
  isFollowedByCurrentUser?: boolean
}): Topic {
  return {
    id: apiTopic.id,
    title: apiTopic.title,
    entryCount: apiTopic.entryCount ?? 0,
    authorId: apiTopic.authorId,
    authorName: apiTopic.authorName,
    authorUsername: apiTopic.authorUsername,
    authorAvatar: apiTopic.authorAvatar ?? null,
    createdAt: apiTopic.createdAt,
    isAnonymous: apiTopic.isAnonymous,
    isTopicOwner: apiTopic.isTopicOwner,
    canManageTopic: apiTopic.canManageTopic,
    isFollowedByCurrentUser: apiTopic.isFollowedByCurrentUser,
  }
}

export function TopicSidebar({
  topics: topicsProp,
  selectedTopicId,
  onTopicSelect,
  onCreateTopic,
  onAllTopicsClick,
  onTopicsLoaded,
  isOpen,
  onClose,
  refreshTrigger = 0,
  accentColor = "#2c64f6",
  mobileOnly = false,
}: TopicSidebarProps) {
  const accentRgb = ACCENT_RGB[accentColor] ?? "44,100,246"
  const buttonColor = BUTTON_COLOR[accentColor] ?? "#1f408e"
  const buttonHoverColor = BUTTON_HOVER_COLOR[buttonColor] ?? "#254b9f"
  const buttonRgb = BUTTON_RGB[buttonColor] ?? "31,64,142"
  const [fetchedTopics, setFetchedTopics] = useState<Topic[]>([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTopics = useCallback(async (pageNum: number, append: boolean) => {
    const url = getApiUrl(`api/Topics/latest?page=${pageNum}&pageSize=50`)
    try {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }
      setError(null)
      const res = await apiFetch(url)
      if (!res.ok) {
        throw new Error(`Sunucu hatası: ${res.status}`)
      }
      const data = await res.json()
      const items = data?.items ?? []
      const mapped = Array.isArray(items) ? items.map(mapApiTopic) : []
      setHasNextPage(data?.hasNextPage ?? false)
      setPage(pageNum)

      let nextTopics: Topic[] = []
      setFetchedTopics((prev) => {
        nextTopics = append ? [...prev, ...mapped] : mapped
        return nextTopics
      })
      onTopicsLoaded?.(nextTopics)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Başlıklar yüklenemedi"
      setError(message)
      if (!append) {
        setFetchedTopics([])
        onTopicsLoaded?.([])
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [onTopicsLoaded])

  useEffect(() => {
    setPage(1)
    fetchTopics(1, false)
  }, [refreshTrigger, fetchTopics])

  const handleLoadMore = useCallback(() => {
    fetchTopics(page + 1, true)
  }, [page, fetchTopics])

  const topics = topicsProp && topicsProp.length > 0 ? topicsProp : fetchedTopics

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-[6.5rem] z-40 h-[calc(100vh-6.5rem)] w-64 md:top-14 md:h-[calc(100vh-3.5rem)] border-r-2 bg-[#252728] transition-transform duration-300 overflow-hidden shadow-[2px_0_16px_rgba(0,0,0,0.28)]",
          mobileOnly
            ? cn(isOpen ? "translate-x-0" : "-translate-x-full", "lg:hidden")
            : cn(
                "lg:w-[280px] xl:w-[312px] lg:translate-x-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
              )
        )}
        style={{
          backgroundColor: "#252728",
          borderRightColor: `rgba(${accentRgb},0.15)`,
          transition: "transform 0.3s ease, border-right-color 0.4s ease",
        }}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Create Topic Button */}
          <div
            className="px-4 py-4 border-b shrink-0 flex flex-col items-start gap-2"
            style={{
              borderBottomColor: `rgba(${accentRgb},0.10)`,
              transition: "border-bottom-color 0.4s ease",
            }}
          >
            <Button
              onClick={onCreateTopic}
              className="w-fit justify-start gap-2 font-semibold rounded-xl border-0"
              size="sm"
              style={{
                backgroundColor: buttonColor,
                color: "rgba(255,255,255,0.90)",
                boxShadow: `0 2px 10px rgba(${buttonRgb},0.35)`,
                transition: "background-color 0.4s ease, box-shadow 0.4s ease",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget
                el.style.backgroundColor = buttonHoverColor
                el.style.boxShadow = `0 3px 14px rgba(${buttonRgb},0.45)`
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.backgroundColor = buttonColor
                el.style.boxShadow = `0 2px 10px rgba(${buttonRgb},0.35)`
              }}
            >
              <Plus className="h-4 w-4" />
              <span>Yeni Başlık</span>
            </Button>
          </div>

          {/* Topics List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3">
              <div className="px-2 py-1.5 mb-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Başlıklar
                </span>
              </div>

              {isLoading ? (
                <div className="space-y-1 py-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-9 w-full rounded-md" />
                  ))}
                </div>
              ) : error ? (
                <div className="py-4 px-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    onClick={() => fetchTopics(1, false)}
                  >
                    Tekrar Dene
                  </Button>
                </div>
              ) : topics.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 px-2">
                  Henüz başlık yok.
                </p>
              ) : (
                <>
                  <nav className="space-y-0.5">
                    {topics.map((topic) => {
                      const isSelected = selectedTopicId === topic.id
                      return (
                        <Link
                          key={topic.id}
                          href={`/?${new URLSearchParams({ topic: topic.id }).toString()}`}
                          scroll={false}
                          onClick={() => {
                            onTopicSelect(topic.id)
                            onClose()
                          }}
                          className={cn(
                            "flex items-start w-full h-auto py-2 px-3 my-0.5 rounded-xl transition-all duration-200 text-left group border-l-[3px]",
                            isSelected
                              ? "text-foreground"
                              : "text-sidebar-foreground hover:bg-[#2c64f6]/6 hover:text-sidebar-accent-foreground border-transparent hover:border-[#2c64f6]/35"
                          )}
                          style={isSelected ? {
                            backgroundColor: `rgba(${accentRgb},0.12)`,
                            borderLeftColor: accentColor,
                            boxShadow: `inset 0 0 0 1px rgba(${accentRgb},0.12)`,
                            transition: "background-color 0.4s ease, border-left-color 0.4s ease, box-shadow 0.4s ease",
                          } : {
                            transition: "background-color 0.4s ease, border-left-color 0.4s ease",
                          }}
                        >
                          <span className="flex-1 min-w-0 whitespace-normal break-words max-w-[30ch] hyphens-auto text-sm leading-snug pr-2">
                            {topic.title}
                          </span>
                          <span className="shrink-0 whitespace-nowrap inline-flex items-center justify-center text-xs px-2 py-0.5 rounded-full mt-0.5 ml-1 text-muted-foreground bg-[#3A3B3C] transition-colors duration-200">
                            {topic.entryCount}
                          </span>
                        </Link>
                      )
                    })}
                  </nav>
                  {hasNextPage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-2 text-muted-foreground hover:text-foreground"
                      onClick={handleLoadMore}
                      disabled={isLoadingMore}
                    >
                      {isLoadingMore ? "Yükleniyor..." : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Daha Fazla Göster
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </aside>
    </>
  )
}
