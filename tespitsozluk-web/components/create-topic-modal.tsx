"use client"

import { useState, useRef, useLayoutEffect } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { RichTextEditor } from "@/components/rich-text-editor"
import { TOPIC_TITLE_MAX_LENGTH, topicTitleSchema } from "@/lib/topic.schema"
import { clampTopicTitleRaw, normalizeTopicTitleForApi } from "@/lib/topic-title-input"
import { FEED_COLUMN_MAX_WIDTH_CLASS } from "@/lib/feed-layout"
import { ENTRY_BODY_EDITOR_INNER_INSET_MODAL_NEW_TOPIC } from "@/lib/entry-body-renderer-classes"
import { getApiUrl, apiFetch } from "@/lib/api"
import { trimComposerHtml } from "@/lib/composer-guard"
import { UnsavedChangesAlertDialog } from "@/components/unsaved-changes-alert-dialog"
import { useBeforeunloadWarning } from "@/hooks/use-beforeunload-warning"
import { useInternalNavigationGuard } from "@/hooks/use-internal-navigation-guard"
import { toast } from "sonner"
import {
  type PollComposerValue,
  isPollValid,
} from "@/components/poll-composer"
import {
  type EntryPollSubmission,
  buildDraftPollPayload,
} from "@/lib/entry-poll"

function trimHtmlContent(html: string): string {
  if (!html) return ""
  let result = html
    .replace(/^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+/gi, "")
  result = result.replace(/(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+$/gi, "")
  return result.trim()
}

interface CreateTopicModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (
    title: string,
    firstEntry: string,
    isAnonymous?: boolean,
    poll?: EntryPollSubmission | null,
  ) => void | Promise<string | null>
  isLoggedIn: boolean
  onLoginClick: () => void
}

export function CreateTopicModal({
  isOpen,
  onClose,
  onCreate,
  isLoggedIn,
  onLoginClick,
}: CreateTopicModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [firstEntry, setFirstEntry] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [poll, setPoll] = useState<PollComposerValue | null>(null)

  const snapshotRef = useRef({ title: "", entry: "", anon: false, hasPoll: false })
  const prevIsOpenRef = useRef(false)

  const hasContent = !!firstEntry.replace(/<[^>]*>/g, "").trim()
  const isOverLimit = charCount >= 100_000
  const pollReady = poll ? isPollValid(poll) : true
  const pollIncomplete = poll !== null && !pollReady
  // Anket varsa boş entry kabul edilir.
  const canPublishContent = (hasContent || (poll !== null && pollReady)) && !pollIncomplete
  const draftPollAvailable = buildDraftPollPayload(poll) !== null
  const canSaveDraftContent = hasContent || draftPollAvailable

  useLayoutEffect(() => {
    if (isOpen && !prevIsOpenRef.current && isLoggedIn) {
      snapshotRef.current = {
        title: normalizeTopicTitleForApi(title),
        entry: firstEntry,
        anon: isAnonymous,
        hasPoll: poll !== null,
      }
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, isLoggedIn, title, firstEntry, isAnonymous, poll])

  const snap = snapshotRef.current
  const isDirty =
    isLoggedIn &&
    (normalizeTopicTitleForApi(title) !== snap.title ||
      trimComposerHtml(firstEntry) !== trimComposerHtml(snap.entry) ||
      isAnonymous !== snap.anon ||
      (poll !== null) !== snap.hasPoll)

  const guardActive = isOpen && isLoggedIn && isDirty
  useBeforeunloadWarning(guardActive)
  useInternalNavigationGuard(guardActive, (path) => {
    setPendingNav(path)
    setUnsavedOpen(true)
  })

  const resetLocal = () => {
    setTitle("")
    setFirstEntry("")
    setCharCount(0)
    setError("")
    setIsAnonymous(false)
    setPoll(null)
  }

  const finalizeClose = () => {
    resetLocal()
    setPendingNav(null)
    onClose()
  }

  const requestClose = () => {
    if (!isLoggedIn) {
      onClose()
      return
    }
    if (isDirty) {
      setPendingNav(null)
      setUnsavedOpen(true)
      return
    }
    finalizeClose()
  }

  const validateAndBuild = () => {
    if (isOverLimit) {
      throw new Error("Entry çok uzun.")
    }
    if (!hasContent && poll === null) {
      throw new Error("Önce entry yazın veya bir anket ekleyin.")
    }
    if (poll !== null && !pollReady) {
      throw new Error("Anket eksik. Soruyu doldurun ve en az 2 farklı seçenek girin.")
    }
    const titleParsed = topicTitleSchema.safeParse(normalizeTopicTitleForApi(title))
    if (!titleParsed.success) {
      throw new Error(titleParsed.error.issues[0]?.message ?? "Geçersiz başlık")
    }
    const finalContent = trimHtmlContent(
      (firstEntry ?? "").replace(/^[\s\n\r\u00a0\u200b]+/, "").replace(/[\s\n\r\u00a0\u200b]+$/, ""),
    )
    if (!finalContent && poll === null) {
      throw new Error("İçerik boş olamaz.")
    }
    const pollPayload: EntryPollSubmission | null =
      poll !== null
        ? {
            question: (poll.question ?? "").trim(),
            options: poll.options.map((o) => o.trim()).filter((o) => o.length > 0),
            allowMultiple: poll.allowMultiple,
            allowUserOptions: poll.allowUserOptions,
          }
        : null
    return { titleData: titleParsed.data, finalContent, pollPayload }
  }

  const persistNewTopicDraft = async () => {
    if (isOverLimit) {
      throw new Error("Entry çok uzun.")
    }
    const titleParsed = topicTitleSchema.safeParse(normalizeTopicTitleForApi(title))
    if (!titleParsed.success) {
      throw new Error(titleParsed.error.issues[0]?.message ?? "Geçersiz başlık")
    }
    const finalContent = trimHtmlContent(
      (firstEntry ?? "").replace(/^[\s\n\r\u00a0\u200b]+/, "").replace(/[\s\n\r\u00a0\u200b]+$/, ""),
    )
    const draftPoll = buildDraftPollPayload(poll)
    if (!finalContent && draftPoll === null) {
      throw new Error("Önce entry yazın veya bir anket ekleyin.")
    }
    const body: {
      content: string
      newTopicTitle: string
      isAnonymous: boolean
      poll?: EntryPollSubmission
    } = {
      content: finalContent,
      newTopicTitle: titleParsed.data,
      isAnonymous,
    }
    if (draftPoll) body.poll = draftPoll
    const res = await apiFetch(getApiUrl("api/Drafts"), {
      method: "POST",
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg = typeof data === "string" ? data : data.message ?? data.title ?? "Taslak kaydedilemedi"
      throw new Error(msg)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    try {
      const { titleData, finalContent, pollPayload } = validateAndBuild()
      await onCreate(titleData, finalContent, isAnonymous, pollPayload)
      resetLocal()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  const publishFromGuard = async () => {
    setIsLoading(true)
    setError("")
    try {
      const { titleData, finalContent, pollPayload } = validateAndBuild()
      const nav = pendingNav
      await onCreate(titleData, finalContent, isAnonymous, pollPayload)
      setUnsavedOpen(false)
      setPendingNav(null)
      resetLocal()
      onClose()
      if (nav) router.push(nav)
    } catch (err) {
      setUnsavedOpen(false)
      setError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveDraft = async () => {
    setIsSavingDraft(true)
    setError("")
    try {
      await persistNewTopicDraft()
      toast.success("Taslak kaydedildi")
      resetLocal()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Taslak kaydedilemedi")
    } finally {
      setIsSavingDraft(false)
    }
  }

  const saveDraftFromGuard = async () => {
    setIsSavingDraft(true)
    setError("")
    try {
      const nav = pendingNav
      await persistNewTopicDraft()
      setUnsavedOpen(false)
      setPendingNav(null)
      resetLocal()
      onClose()
      if (nav) router.push(nav)
    } catch (err) {
      setUnsavedOpen(false)
      setError(err instanceof Error ? err.message : "Taslak kaydedilemedi")
    } finally {
      setIsSavingDraft(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm"
          onClick={requestClose}
        />
        <div
          className={cn(
            "relative z-50 flex w-full min-h-[50vh] max-h-[min(92vh,900px)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
            FEED_COLUMN_MAX_WIDTH_CLASS,
          )}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 pb-3 pt-4">
            <h2 className="text-xl font-semibold text-foreground">Yeni Başlık</h2>
            <button
              type="button"
              onClick={requestClose}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto box-border px-6 pb-5 pt-6">
            {!isLoggedIn ? (
              <div className="pb-6 pt-0 text-center">
                <p className="mb-4 text-muted-foreground">
                  Yeni başlık oluşturmak için giriş yapmalısınız.
                </p>
                <Button
                  onClick={() => {
                    onClose()
                    onLoginClick()
                  }}
                  className="bg-foreground text-background hover:bg-foreground/90"
                >
                  Giriş Yap
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex w-full min-w-0 max-w-full flex-col gap-0 [&>*+*]:mt-4">
                <div className="space-y-2">
                  <Label htmlFor="topic-title" className="text-sm text-foreground">
                    Başlık
                  </Label>
                  <Textarea
                    id="topic-title"
                    placeholder="başlık adı"
                    value={title}
                    onChange={(e) => setTitle(clampTopicTitleRaw(e.target.value))}
                    required
                    rows={2}
                    className="w-full min-w-0 max-w-[30ch] overflow-x-hidden whitespace-pre-wrap break-words hyphens-auto resize-none min-h-10 border-border bg-secondary/50 py-2 text-base md:text-base focus:border-ring field-sizing-content"
                  />
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ? "font-medium text-destructive" : "text-muted-foreground"}`}
                    >
                      {normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH
                        ? "Başlık en fazla 60 karakter olabilir."
                        : `${normalizeTopicTitleForApi(title).length}/${TOPIC_TITLE_MAX_LENGTH}`}
                    </span>
                  </div>
                </div>

                <div className="flex w-full min-w-0 max-w-full flex-col space-y-0">
                  <Label className="mb-2 text-sm text-foreground">İlk Entry</Label>
                  <div className="m-0 w-full min-w-0 max-w-full p-0">
                    <RichTextEditor
                      value={firstEntry}
                      onChange={setFirstEntry}
                      placeholder="düşüncelerinizi yazın..."
                      onCharCountChange={setCharCount}
                      innerContentPaddingClassName={ENTRY_BODY_EDITOR_INNER_INSET_MODAL_NEW_TOPIC}
                      toolbarStickyTopClass="top-0"
                      poll={poll}
                      onPollChange={setPoll}
                      pollDisabled={isLoading || isSavingDraft}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <RadioGroup
                    value={isAnonymous ? "anonymous" : "account"}
                    onValueChange={(v) => setIsAnonymous(v === "anonymous")}
                    className="flex flex-wrap items-center gap-x-6 gap-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="account" id="create-topic-account" />
                      <Label htmlFor="create-topic-account" className="cursor-pointer text-sm font-normal">
                        Kendi hesabınla paylaş
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="anonymous" id="create-topic-anonymous" />
                      <Label htmlFor="create-topic-anonymous" className="cursor-pointer text-sm font-normal">
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

                {isOverLimit && (
                  <p className="text-sm font-medium text-red-500">
                    Entry maksimum 100.000 karakter olabilir. Lütfen içeriği kısaltın.
                  </p>
                )}
                {!isOverLimit && error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={
                      !normalizeTopicTitleForApi(title) ||
                      !canSaveDraftContent ||
                      normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ||
                      isLoading ||
                      isSavingDraft ||
                      isOverLimit
                    }
                    className="h-10 w-full sm:flex-1"
                  >
                    {isSavingDraft ? "Kaydediliyor..." : "Taslak Olarak Kaydet"}
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      !normalizeTopicTitleForApi(title) ||
                      !canPublishContent ||
                      normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ||
                      isLoading ||
                      isSavingDraft ||
                      isOverLimit
                    }
                    className="h-10 w-full shrink-0 bg-foreground text-background hover:bg-foreground/90 sm:flex-1"
                  >
                    {isLoading ? "Oluşturuluyor..." : "Başlık Oluştur"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <UnsavedChangesAlertDialog
        mode="compose-publish"
        open={unsavedOpen}
        onOpenChange={setUnsavedOpen}
        isPublishing={isLoading}
        isSavingDraft={isSavingDraft}
        publishDisabled={
          !normalizeTopicTitleForApi(title) ||
          !canPublishContent ||
          normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ||
          isOverLimit ||
          isSavingDraft
        }
        saveDraftDisabled={
          !normalizeTopicTitleForApi(title) ||
          !canSaveDraftContent ||
          normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ||
          isOverLimit ||
          isLoading
        }
        onPublish={publishFromGuard}
        onSaveDraft={saveDraftFromGuard}
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
