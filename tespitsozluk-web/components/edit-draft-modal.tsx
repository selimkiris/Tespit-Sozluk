"use client"

import { useState, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TOPIC_TITLE_MAX_LENGTH } from "@/lib/topic.schema"
import { clampTopicTitleRaw, normalizeTopicTitleForApi } from "@/lib/topic-title-input"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"

type TopicSearchResult = { id: string; title: string }

type Draft = {
  id: string
  content: string
  topicId?: string | null
  topicTitle?: string | null
  newTopicTitle?: string | null
  isAnonymous?: boolean
}

interface EditDraftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  draft: Draft | null
  onSuccess: () => void
}

export function EditDraftModal({
  open,
  onOpenChange,
  draft,
  onSuccess,
}: EditDraftModalProps) {
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [topicSearch, setTopicSearch] = useState("")
  const [topicResults, setTopicResults] = useState<TopicSearchResult[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicSearchResult | null>(null)
  const [newTopicTitle, setNewTopicTitle] = useState("")
  const [content, setContent] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const searchTopics = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setTopicResults([])
      return
    }
    try {
      const res = await fetch(getApiUrl(`api/Search?q=${encodeURIComponent(q.trim())}`))
      if (!res.ok) return
      const data = await res.json()
      const topics = (data.topics ?? []).map((t: { id: string; title: string }) => ({
        id: String(t.id),
        title: t.title ?? "",
      }))
      setTopicResults(topics)
    } catch {
      setTopicResults([])
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchTopics(topicSearch), 300)
    return () => clearTimeout(t)
  }, [topicSearch, searchTopics])

  useEffect(() => {
    if (draft && open) {
      setContent(draft.content)
      setIsAnonymous(draft.isAnonymous ?? false)
      if (draft.topicId && draft.topicTitle) {
        setMode("existing")
        setSelectedTopic({ id: draft.topicId, title: draft.topicTitle })
        setTopicSearch(draft.topicTitle)
        setNewTopicTitle("")
      } else if (draft.newTopicTitle) {
        setMode("new")
        setNewTopicTitle(draft.newTopicTitle)
        setSelectedTopic(null)
        setTopicSearch("")
      } else {
        setMode("existing")
        setSelectedTopic(null)
        setTopicSearch("")
        setNewTopicTitle("")
      }
      setError("")
    }
  }, [draft, open])

  const handleOpenChange = (next: boolean) => {
    if (!next) setError("")
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    if (!draft) return
    const cleanContent = content.trim()
    if (!cleanContent.replace(/<[^>]*>/g, "").trim()) {
      setError("İçerik boş olamaz.")
      return
    }

    let normalizedNewTopicTitle = ""
    if (mode === "existing") {
      if (!selectedTopic) {
        setError("Lütfen bir başlık seçin veya yeni başlık moduna geçin.")
        return
      }
    } else {
      normalizedNewTopicTitle = normalizeTopicTitleForApi(newTopicTitle)
      if (!normalizedNewTopicTitle) {
        setError("Yeni başlık adı boş olamaz.")
        return
      }
      if (normalizedNewTopicTitle.length > TOPIC_TITLE_MAX_LENGTH) {
        setError(`Başlık en fazla ${TOPIC_TITLE_MAX_LENGTH} karakter olabilir.`)
        return
      }
    }

    setIsSubmitting(true)
    setError("")
    try {
      const body: { content: string; topicId?: string; newTopicTitle?: string; isAnonymous?: boolean } = {
        content: cleanContent,
        isAnonymous,
      }
      if (mode === "existing" && selectedTopic) {
        body.topicId = selectedTopic.id
      } else {
        body.newTopicTitle = normalizedNewTopicTitle
      }

      const res = await fetch(getApiUrl(`api/Drafts/${draft.id}`), {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data === "string" ? data : data.message ?? data.title ?? "Taslak güncellenemedi"
        throw new Error(msg)
      }
      handleOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Taslak güncellenemedi")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open || !draft) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => handleOpenChange(false)} />
      <div
        className={cn(
          "relative z-50 flex w-full min-h-[50vh] max-h-[min(92vh,900px)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
          FEED_COLUMN_MAX_WIDTH_CLASS
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Taslağı Düzenle</h2>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto box-border px-6 py-5">
          <div className="flex min-h-0 min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
            <RadioGroup
              value={mode}
              onValueChange={(v) => {
                setMode(v as "existing" | "new")
                setSelectedTopic(null)
                setTopicSearch("")
                setNewTopicTitle("")
                setError("")
              }}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existing" id="edit-mode-existing" />
                <Label htmlFor="edit-mode-existing">Mevcut Başlık</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="edit-mode-new" />
                <Label htmlFor="edit-mode-new">Yeni Başlık</Label>
              </div>
            </RadioGroup>

            {mode === "existing" ? (
              <div className="space-y-2">
                <Label className="text-sm text-foreground">Başlık Ara / Seç</Label>
                <div className="relative">
                  <Input
                    value={topicSearch}
                    onChange={(e) => {
                      setTopicSearch(e.target.value)
                      setSelectedTopic(null)
                    }}
                    placeholder="Başlık adı yazın (min 2 karakter)..."
                    className="h-10 border-border bg-secondary/50 pr-2 focus:border-ring"
                  />
                  {topicResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-40 overflow-auto rounded-md border border-border bg-card shadow-lg">
                      {topicResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                          onClick={() => {
                            setSelectedTopic(t)
                            setTopicSearch(t.title)
                            setTopicResults([])
                          }}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedTopic && (
                  <p className="text-xs text-muted-foreground">
                    Seçili: <span className="font-medium text-foreground">{selectedTopic.title}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-new-topic-title" className="text-sm text-foreground">
                  Yeni Başlık Adı
                </Label>
                <Textarea
                  id="edit-new-topic-title"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(clampTopicTitleRaw(e.target.value))}
                  placeholder="Yeni başlık adı..."
                  rows={2}
                  className="w-full min-w-0 max-w-[30ch] overflow-x-hidden whitespace-pre-wrap break-words hyphens-auto resize-none min-h-10 border-border bg-secondary/50 py-2 text-base md:text-base focus:border-ring field-sizing-content"
                />
                <span className="text-xs text-muted-foreground">
                  {normalizeTopicTitleForApi(newTopicTitle).length}/{TOPIC_TITLE_MAX_LENGTH}
                </span>
              </div>
            )}

            <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col space-y-2 overflow-x-hidden">
              <Label className="text-sm text-foreground" htmlFor="edit-draft-content">
                İçerik
              </Label>
              <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-x-hidden [&_div.tiptap]:!min-h-[min(38vh,320px)]">
                <RichTextEditor
                  value={content}
                  onChange={setContent}
                  placeholder="düşüncelerinizi yazın..."
                  innerContentPaddingClassName="px-[0.45rem]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <RadioGroup
                value={isAnonymous ? "anonymous" : "account"}
                onValueChange={(v) => setIsAnonymous(v === "anonymous")}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="account" id="edit-draft-account" />
                  <Label htmlFor="edit-draft-account" className="cursor-pointer text-sm font-normal">
                    Kendi hesabınla paylaş
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="anonymous" id="edit-draft-anonymous" />
                  <Label htmlFor="edit-draft-anonymous" className="cursor-pointer text-sm font-normal">
                    Tam anonim paylaş
                  </Label>
                </div>
              </RadioGroup>
              {isAnonymous && (
                <p className="text-xs text-muted-foreground">
                  Tam Anonim modda paylaşılan entrylerde Kullanıcı adı görünmez, profile erişilemez. Kullanıcı adı
                  kısmında sadece Anonim yazar ve profil fotoğrafı gösterilmez. Sadece tarih bilgisi yer alır.
                </p>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={() => handleOpenChange(false)}>
                İptal
              </Button>
              <Button type="button" className="h-10 w-full bg-foreground text-background hover:bg-foreground/90 sm:w-auto" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
