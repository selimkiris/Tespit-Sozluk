"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getApiUrl, getAuthHeaders } from "@/lib/api"

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
    if (!content.replace(/<[^>]*>/g, "").trim()) {
      setError("İçerik boş olamaz.")
      return
    }

    if (mode === "existing") {
      if (!selectedTopic) {
        setError("Lütfen bir başlık seçin veya yeni başlık moduna geçin.")
        return
      }
    } else {
      if (!newTopicTitle.trim()) {
        setError("Yeni başlık adı boş olamaz.")
        return
      }
    }

    setIsSubmitting(true)
    setError("")
    try {
      const body: { content: string; topicId?: string; newTopicTitle?: string; isAnonymous?: boolean } = {
        content: content.trim(),
        isAnonymous,
      }
      if (mode === "existing" && selectedTopic) {
        body.topicId = selectedTopic.id
        // NewTopicTitle kesinlikle gönderilmez - mevcut başlık modu
      } else {
        body.newTopicTitle = newTopicTitle.trim()
        // TopicId kesinlikle gönderilmez - yeni başlık modu
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

  if (!draft) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Taslağı Düzenle</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              <Label>Başlık Ara / Seç</Label>
              <div className="relative">
                <Input
                  value={topicSearch}
                  onChange={(e) => {
                    setTopicSearch(e.target.value)
                    setSelectedTopic(null)
                  }}
                  placeholder="Başlık adı yazın (min 2 karakter)..."
                  className="pr-2"
                />
                {topicResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 max-h-40 overflow-auto">
                    {topicResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
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
              <Label htmlFor="edit-new-topic-title">Yeni Başlık Adı</Label>
              <Input
                id="edit-new-topic-title"
                value={newTopicTitle}
                onChange={(e) => setNewTopicTitle(e.target.value.slice(0, 70))}
                placeholder="Yeni başlık adı..."
                maxLength={70}
              />
              <span className="text-xs text-muted-foreground">{newTopicTitle.length}/70</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="edit-draft-content">İçerik</Label>
            <Textarea
              id="edit-draft-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Entry içeriğinizi yazın..."
              className="min-h-[320px] resize-y text-base"
              rows={14}
            />
          </div>

          <div className="space-y-1">
            <RadioGroup
              value={isAnonymous ? "anonymous" : "account"}
              onValueChange={(v) => setIsAnonymous(v === "anonymous")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="account" id="edit-draft-account" />
                <Label htmlFor="edit-draft-account" className="text-sm font-normal cursor-pointer">
                  Kendi hesabınla paylaş
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="anonymous" id="edit-draft-anonymous" />
                <Label htmlFor="edit-draft-anonymous" className="text-sm font-normal cursor-pointer">
                  Tam anonim paylaş
                </Label>
              </div>
            </RadioGroup>
            {isAnonymous && (
              <p className="text-xs text-muted-foreground">
                Tam Anonim modda paylaşılan entrylerde Kullanıcı adı görünmez, profile erişilemez. Kullanıcı adı kısmında sadece Anonim yazar ve profil fotoğrafı gösterilmez. Sadece tarih bilgisi yer alır.
              </p>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
