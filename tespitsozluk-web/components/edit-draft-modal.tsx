"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/rich-text-editor"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getApiUrl, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import { TOPIC_TITLE_MAX_LENGTH } from "@/lib/topic.schema"
import { clampTopicTitleRaw, normalizeTopicTitleForApi } from "@/lib/topic-title-input"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"
import { ENTRY_BODY_EDITOR_INNER_INSET_MODAL_DRAFT } from "@/lib/entry-body-renderer-classes"
import { trimComposerHtml } from "@/lib/composer-guard"
import { UnsavedChangesAlertDialog } from "@/components/unsaved-changes-alert-dialog"
import { useBeforeunloadWarning } from "@/hooks/use-beforeunload-warning"
import { useInternalNavigationGuard } from "@/hooks/use-internal-navigation-guard"

type TopicSearchResult = { id: string; title: string }

type Draft = {
  id: string
  content: string
  topicId?: string | null
  topicTitle?: string | null
  newTopicTitle?: string | null
  isAnonymous?: boolean
}

function buildDraftSnapshot(p: {
  mode: "existing" | "new"
  topicSearch: string
  selectedTopic: TopicSearchResult | null
  newTopicTitle: string
  content: string
  isAnonymous: boolean
}) {
  return JSON.stringify({
    mode: p.mode,
    topicSearch: p.topicSearch.trim(),
    selectedId: p.selectedTopic?.id ?? null,
    newTitle: normalizeTopicTitleForApi(p.newTopicTitle),
    content: trimComposerHtml(p.content),
    isAnonymous: p.isAnonymous,
  })
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
  const router = useRouter()
  const [mode, setMode] = useState<"existing" | "new">("existing")
  const [topicSearch, setTopicSearch] = useState("")
  const [topicResults, setTopicResults] = useState<TopicSearchResult[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicSearchResult | null>(null)
  const [newTopicTitle, setNewTopicTitle] = useState("")
  const [content, setContent] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [draftLoading, setDraftLoading] = useState(false)
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)

  const snapshotRef = useRef("")
  const baselinePendingRef = useRef(true)

  const searchTopics = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setTopicResults([])
      return
    }
    try {
      const res = await apiFetch(getApiUrl(`api/Search?q=${encodeURIComponent(q.trim())}`))
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
    if (!open) {
      baselinePendingRef.current = true
    }
  }, [open])

  useEffect(() => {
    baselinePendingRef.current = true
  }, [draft?.id])

  useEffect(() => {
    if (draftLoading) {
      baselinePendingRef.current = true
    }
  }, [draftLoading])

  useEffect(() => {
    if (!draft || !open) return
    let cancelled = false
    setDraftLoading(true)
    setError("")
    ;(async () => {
      try {
        const res = await apiFetch(getApiUrl(`api/Drafts/${draft.id}`))
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof data === "string" ? data : data.message ?? data.title ?? "Taslak yüklenemedi"
          throw new Error(msg)
        }
        if (cancelled) return
        setContent(typeof data.content === "string" ? data.content : "")
        setIsAnonymous(Boolean(data.isAnonymous))
        if (data.topicId && data.topicTitle) {
          setMode("existing")
          setSelectedTopic({ id: String(data.topicId), title: String(data.topicTitle) })
          setTopicSearch(String(data.topicTitle))
          setNewTopicTitle("")
        } else if (data.newTopicTitle) {
          setMode("new")
          setNewTopicTitle(String(data.newTopicTitle))
          setSelectedTopic(null)
          setTopicSearch("")
        } else {
          setMode("existing")
          setSelectedTopic(null)
          setTopicSearch("")
          setNewTopicTitle("")
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Taslak yüklenemedi")
        }
      } finally {
        if (!cancelled) setDraftLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [draft?.id, open])

  useEffect(() => {
    if (!open || !draft || draftLoading) return
    if (baselinePendingRef.current) {
      snapshotRef.current = buildDraftSnapshot({
        mode,
        topicSearch,
        selectedTopic,
        newTopicTitle,
        content,
        isAnonymous,
      })
      baselinePendingRef.current = false
    }
  }, [
    open,
    draft,
    draftLoading,
    mode,
    topicSearch,
    selectedTopic,
    newTopicTitle,
    content,
    isAnonymous,
  ])

  const isDirty =
    open &&
    !draftLoading &&
    buildDraftSnapshot({
      mode,
      topicSearch,
      selectedTopic,
      newTopicTitle,
      content,
      isAnonymous,
    }) !== snapshotRef.current

  useBeforeunloadWarning(isDirty)
  useInternalNavigationGuard(isDirty, (path) => {
    setPendingNav(path)
    setUnsavedOpen(true)
  })

  const finalizeClose = () => {
    setError("")
    setPendingNav(null)
    onOpenChange(false)
  }

  const requestClose = () => {
    if (draftLoading) {
      finalizeClose()
      return
    }
    if (isDirty) {
      setPendingNav(null)
      setUnsavedOpen(true)
      return
    }
    finalizeClose()
  }

  const validateAndPut = async () => {
    if (!draft || draftLoading) return
    const cleanContent = content.trim()
    if (!cleanContent.replace(/<[^>]*>/g, "").trim()) {
      throw new Error("İçerik boş olamaz.")
    }

    let normalizedNewTopicTitle = ""
    if (mode === "existing") {
      if (!selectedTopic) {
        throw new Error("Lütfen bir başlık seçin veya yeni başlık moduna geçin.")
      }
    } else {
      normalizedNewTopicTitle = normalizeTopicTitleForApi(newTopicTitle)
      if (!normalizedNewTopicTitle) {
        throw new Error("Yeni başlık adı boş olamaz.")
      }
      if (normalizedNewTopicTitle.length > TOPIC_TITLE_MAX_LENGTH) {
        throw new Error(`Başlık en fazla ${TOPIC_TITLE_MAX_LENGTH} karakter olabilir.`)
      }
    }

    const body: { content: string; topicId?: string; newTopicTitle?: string; isAnonymous?: boolean } = {
      content: cleanContent,
      isAnonymous,
    }
    if (mode === "existing" && selectedTopic) {
      body.topicId = selectedTopic.id
    } else {
      body.newTopicTitle = normalizedNewTopicTitle
    }

    const res = await apiFetch(getApiUrl(`api/Drafts/${draft.id}`), {
      method: "PUT",
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = typeof data === "string" ? data : data.message ?? data.title ?? "Taslak güncellenemedi"
      throw new Error(msg)
    }
  }

  const handleSubmit = async () => {
    if (!draft || draftLoading) return
    setIsSubmitting(true)
    setError("")
    try {
      await validateAndPut()
      finalizeClose()
      onSuccess()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Taslak güncellenemedi")
    } finally {
      setIsSubmitting(false)
    }
  }

  const saveFromGuard = async () => {
    setIsSubmitting(true)
    setError("")
    try {
      const nav = pendingNav
      await validateAndPut()
      setUnsavedOpen(false)
      setPendingNav(null)
      finalizeClose()
      onSuccess()
      if (nav) router.push(nav)
    } catch (err) {
      setUnsavedOpen(false)
      setError(err instanceof Error ? err.message : "Taslak güncellenemedi")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open || !draft) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={requestClose} />
        <div
          className={cn(
            "relative z-50 flex w-full min-h-[50vh] max-h-[min(92vh,900px)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            FEED_COLUMN_MAX_WIDTH_CLASS,
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 pb-3 pt-4">
            <h2 className="text-xl font-semibold text-foreground">Taslağı Düzenle</h2>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto box-border px-6 pb-5 pt-6">
            <div className="flex w-full min-w-0 max-w-full flex-col gap-0 [&>*+*]:mt-4">
              <RadioGroup
                value={mode}
                onValueChange={(v) => {
                  setMode(v as "existing" | "new")
                  setSelectedTopic(null)
                  setTopicSearch("")
                  setNewTopicTitle("")
                  setError("")
                }}
                className="flex flex-wrap items-center gap-x-6 gap-y-3"
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

              <div className="flex w-full min-w-0 max-w-full flex-col space-y-0">
                <Label className="mb-2 text-sm text-foreground" htmlFor="edit-draft-content">
                  İçerik
                </Label>
                <div className="m-0 w-full min-w-0 max-w-full p-0">
                  {draftLoading ? (
                    <div className="flex min-h-[150px] items-center justify-center rounded-md border border-border bg-secondary/30 text-sm text-muted-foreground">
                      Taslak yükleniyor…
                    </div>
                  ) : (
                    <RichTextEditor
                      value={content}
                      onChange={setContent}
                      placeholder="düşüncelerinizi yazın..."
                      innerContentPaddingClassName={ENTRY_BODY_EDITOR_INNER_INSET_MODAL_DRAFT}
                      toolbarStickyTopClass="top-0"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <RadioGroup
                  value={isAnonymous ? "anonymous" : "account"}
                  onValueChange={(v) => setIsAnonymous(v === "anonymous")}
                  className="flex flex-wrap items-center gap-x-6 gap-y-3"
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
                <Button type="button" variant="outline" className="h-10 w-full sm:w-auto" onClick={requestClose}>
                  İptal
                </Button>
                <Button
                  type="button"
                  className="h-10 w-full bg-foreground text-background hover:bg-foreground/90 sm:w-auto"
                  onClick={handleSubmit}
                  disabled={isSubmitting || draftLoading}
                >
                  {isSubmitting ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UnsavedChangesAlertDialog
        mode="draft"
        open={unsavedOpen}
        onOpenChange={setUnsavedOpen}
        isSaving={isSubmitting}
        saveDisabled={draftLoading}
        onSave={saveFromGuard}
        onDiscard={() => {
          const nav = pendingNav
          setPendingNav(null)
          finalizeClose()
          if (nav) router.push(nav)
        }}
      />
    </>
  )
}
