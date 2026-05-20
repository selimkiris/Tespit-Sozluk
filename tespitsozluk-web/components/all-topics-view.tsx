"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { X, Search, Hash, ChevronDown, Loader2 } from "lucide-react"
import { getApiUrl, apiFetch } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Topic {
  id: string
  title: string
  /** Opsiyonel SEO slug; varsa liste öğesinden slug rotasına gidilebilir. */
  slug?: string
  entryCount: number
}

type SortMode = "alphabetical" | "chronological" | "entryCount"

function mapApiTopic(t: { id: string; title: string; slug?: string | null; entryCount?: number }): Topic {
  return {
    id: String(t.id),
    title: t.title ?? "",
    slug: typeof t.slug === "string" && t.slug.length > 0 ? t.slug : undefined,
    entryCount: t.entryCount ?? 0,
  }
}

interface AllTopicsViewProps {
  isOpen: boolean
  onClose: () => void
  topics?: Topic[]
  onTopicSelect: (topicId: string) => void
  initialSearchQuery?: string | null
}

export function AllTopicsView({
  isOpen,
  onClose,
  topics: topicsProp,
  onTopicSelect,
  initialSearchQuery,
}: AllTopicsViewProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? "")
  const [sortMode, setSortMode] = useState<SortMode>("alphabetical")
  const [topics, setTopics] = useState<Topic[]>([])
  const [page, setPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [totalTopicsCount, setTotalTopicsCount] = useState<number | null>(null)

  const fetchTopics = useCallback(async (pageNum: number, append: boolean, sort: SortMode) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }
    try {
      const res = await apiFetch(
        getApiUrl(`api/Topics/alphabetical?page=${pageNum}&pageSize=50&sortBy=${sort}`)
      )
      if (!res.ok) throw new Error("Başlıklar yüklenemedi")
      const data = await res.json()
      const items = data?.items ?? []
      const mapped = Array.isArray(items) ? items.map(mapApiTopic) : []
      setTopics((prev) => (append ? [...prev, ...mapped] : mapped))
      setHasNextPage(data?.hasNextPage ?? false)
      setPage(pageNum)
      const tc = data?.totalCount
      if (typeof tc === "number") setTotalTopicsCount(tc)
    } catch {
      if (!append) {
        setTopics([])
        setTotalTopicsCount(null)
      }
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setPage(1)
      setTotalTopicsCount(null)
      fetchTopics(1, false, sortMode)
      if (initialSearchQuery != null) {
        setSearchQuery(initialSearchQuery)
      }
    }
  }, [isOpen, fetchTopics, initialSearchQuery, sortMode])

  const handleLoadMore = useCallback(() => {
    fetchTopics(page + 1, true, sortMode)
  }, [page, fetchTopics, sortMode])

  const displayTopics = topics.length > 0 ? topics : (topicsProp ?? [])

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return displayTopics
    return displayTopics.filter((topic) =>
      topic.title.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [displayTopics, searchQuery])

  const groupedTopics = useMemo(() => {
    if (sortMode !== "alphabetical") return null
    const groups: Record<string, Topic[]> = {}
    filteredTopics.forEach((topic) => {
      const firstChar = topic.title[0]?.toUpperCase() ?? "#"
      if (!groups[firstChar]) {
        groups[firstChar] = []
      }
      groups[firstChar].push(topic)
    })
    return groups
  }, [filteredTopics, sortMode])

  const handleTopicClick = (topicId: string) => {
    onTopicSelect(topicId)
    onClose()
  }

  const renderTopicRow = (topic: Topic) => (
    <button
      key={topic.id}
      onClick={() => handleTopicClick(topic.id)}
      className="flex items-start justify-between w-full px-3 py-2.5 text-left rounded-lg hover:bg-secondary/70 transition-colors group"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <Hash className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
        <span className="text-sm text-foreground break-words hyphens-auto whitespace-pre-wrap min-w-0">
          {topic.title}
        </span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 whitespace-nowrap ml-3 mt-0.5">
        {topic.entryCount} entry
      </span>
    </button>
  )

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

        {/* Search + sort */}
        <div className="p-4 border-b border-border shrink-0 space-y-3">
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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isLoading && !isLoadingMore ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin shrink-0" aria-hidden />
                  <span>Toplam başlık: …</span>
                </span>
              ) : totalTopicsCount !== null ? (
                <>Toplam başlık: {totalTopicsCount.toLocaleString("tr-TR")}</>
              ) : (
                <>Toplam başlık: …</>
              )}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Sıralama:</span>
              <Select
                value={sortMode}
                onValueChange={(v) => setSortMode(v as SortMode)}
                disabled={isLoading && !isLoadingMore}
              >
                <SelectTrigger className="h-8 w-[160px] text-xs" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alphabetical">Alfabetik</SelectItem>
                  <SelectItem value="chronological">Kronolojik</SelectItem>
                  <SelectItem value="entryCount">Entry Sayısı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Topics List */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto max-h-[60vh] pr-2">
            <div className="p-4 space-y-6">
              {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Yükleniyor...</div>
              ) : groupedTopics ? (
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
                          {groupedTopics[letter].map((topic) => renderTopicRow(topic))}
                        </div>
                      </div>
                    ))}
                  {!isLoading && filteredTopics.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">Başlık bulunamadı</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid gap-1">
                    {filteredTopics.map((topic) => renderTopicRow(topic))}
                  </div>
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
