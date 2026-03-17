"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { X, Search, Hash, ChevronDown } from "lucide-react"
import { getApiUrl } from "@/lib/api"
import { Button } from "@/components/ui/button"

interface Topic {
  id: string
  title: string
  entryCount: number
}

function mapApiTopic(t: { id: string; title: string; entryCount?: number }): Topic {
  return {
    id: String(t.id),
    title: t.title ?? "",
    entryCount: t.entryCount ?? 0,
  }
}

interface AllTopicsViewProps {
  isOpen: boolean
  onClose: () => void
  topics?: Topic[]
  onTopicSelect: (topicId: string) => void
}

export function AllTopicsView({
  isOpen,
  onClose,
  topics: topicsProp,
  onTopicSelect,
}: AllTopicsViewProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [topics, setTopics] = useState<Topic[]>([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchTopics = useCallback(async (pageNum: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    try {
      const res = await fetch(getApiUrl(`api/Topics/alphabetical?page=${pageNum}&pageSize=50`))
      if (!res.ok) throw new Error("Başlıklar yüklenemedi")
      const data = await res.json()
      const items = data?.items ?? []
      const mapped = Array.isArray(items) ? items.map(mapApiTopic) : []
      setTopics((prev) => (append ? [...prev, ...mapped] : mapped))
      setHasNextPage(data?.hasNextPage ?? false)
      setPage(pageNum)
    } catch {
      if (!append) setTopics([])
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setPage(1)
      fetchTopics(1, false)
    }
  }, [isOpen, fetchTopics])

  const handleLoadMore = useCallback(() => {
    fetchTopics(page + 1, true)
  }, [page, fetchTopics])

  const displayTopics = topics.length > 0 ? topics : (topicsProp ?? [])

  const sortedTopics = useMemo(() => {
    return [...displayTopics].sort((a, b) => a.title.localeCompare(b.title, "tr"))
  }, [displayTopics])

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return sortedTopics
    return sortedTopics.filter((topic) =>
      topic.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [sortedTopics, searchQuery])

  const groupedTopics = useMemo(() => {
    const groups: Record<string, Topic[]> = {}
    filteredTopics.forEach((topic) => {
      const firstChar = topic.title[0].toUpperCase()
      if (!groups[firstChar]) {
        groups[firstChar] = []
      }
      groups[firstChar].push(topic)
    })
    return groups
  }, [filteredTopics])

  const handleTopicClick = (topicId: string) => {
    onTopicSelect(topicId)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl bg-card border border-border rounded-xl shadow-lg mx-4 max-h-[85vh] flex flex-col overflow-hidden min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="text-xl font-semibold text-foreground">Tüm Başlıklar</h2>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Başlık ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-secondary/50 border-0 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {filteredTopics.length} başlık alfabetik sırayla listelendi
          </p>
        </div>

        {/* Topics List - max-h ve overflow ile scroll */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div
            className="flex-1 min-h-0 overflow-y-auto max-h-[60vh] scrollbar-thin pr-2"
          >
            <div className="p-4 space-y-6">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
              ) : (
                <>
                  {Object.keys(groupedTopics)
                    .sort((a, b) => a.localeCompare(b, "tr"))
                    .map((letter) => (
                      <div key={letter}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg font-semibold text-foreground">{letter}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                        <div className="grid gap-1">
                          {groupedTopics[letter].map((topic) => (
                            <button
                              key={topic.id}
                              onClick={() => handleTopicClick(topic.id)}
                              className="flex items-center justify-between w-full px-3 py-2.5 text-left rounded-lg hover:bg-secondary/70 transition-colors group"
                            >
                              <div className="flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                <span className="text-sm text-foreground">{topic.title}</span>
                              </div>
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {topic.entryCount} entry
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  {!isLoading && filteredTopics.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Başlık bulunamadı</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Daha Fazla Göster */}
          {!isLoading && hasNextPage && (
            <div className="p-4 border-t border-border shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? (
                  "Yükleniyor..."
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" />
                    Daha Fazla Göster
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
