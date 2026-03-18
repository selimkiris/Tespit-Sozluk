"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, ChevronDown } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface Topic {
  id: string
  title: string
  entryCount: number
  authorId?: string
}

interface TopicSidebarProps {
  topics?: Topic[]
  selectedTopicId?: string
  onTopicSelect: (topicId: string) => void
  onCreateTopic: () => void
  onTopicsLoaded?: (topics: Topic[]) => void
  isOpen: boolean
  onClose: () => void
  refreshTrigger?: number
}

function mapApiTopic(apiTopic: { id: string; title: string; entryCount?: number; authorId?: string }): Topic {
  return {
    id: apiTopic.id,
    title: apiTopic.title,
    entryCount: apiTopic.entryCount ?? 0,
    authorId: apiTopic.authorId,
  }
}

export function TopicSidebar({
  topics: topicsProp,
  selectedTopicId,
  onTopicSelect,
  onCreateTopic,
  onTopicsLoaded,
  isOpen,
  onClose,
  refreshTrigger = 0,
}: TopicSidebarProps) {
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
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Sunucu hatası: ${res.status}`)
      }
      const data = await res.json()
      const items = data?.items ?? []
      const mapped = Array.isArray(items) ? items.map(mapApiTopic) : []
      setHasNextPage(data?.hasNextPage ?? false)
      setPage(pageNum)

      let combined: Topic[]
      setFetchedTopics((prev) => {
        combined = append ? [...prev, ...mapped] : mapped
        return combined
      })
      onTopicsLoaded?.(Array.isArray(combined) ? combined : [])
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
          "fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-64 border-r border-border bg-sidebar transition-transform duration-300 lg:translate-x-0 overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full min-h-0">
          {/* Create Topic Button */}
          <div className="p-4 border-b border-sidebar-border shrink-0">
            <Button
              onClick={onCreateTopic}
              className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span>Yeni Başlık</span>
            </Button>
          </div>

          {/* Topics List */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-2">
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
                    {topics.map((topic) => (
                      <Link
                        key={topic.id}
                        href={`/?topic=${topic.id}`}
                        onClick={() => {
                          onTopicSelect(topic.id)
                          onClose()
                        }}
                        className={cn(
                          "flex items-start w-full h-auto py-2 px-3 my-1 rounded-md transition-colors text-left group",
                          selectedTopicId === topic.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <span className="flex-1 min-w-0 whitespace-normal break-words text-sm leading-snug pr-2">
                          {topic.title}
                        </span>
                        <span className="shrink-0 whitespace-nowrap inline-flex items-center justify-center bg-secondary text-secondary-foreground text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ml-1">
                          {topic.entryCount}
                        </span>
                      </Link>
                    ))}
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
