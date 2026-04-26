"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getApiUrl, apiFetch } from "@/lib/api"
import { hasMeaningfulComposerHtml, trimComposerHtml } from "@/lib/composer-guard"
import { UnsavedChangesAlertDialog } from "@/components/unsaved-changes-alert-dialog"
import { useBeforeunloadWarning } from "@/hooks/use-beforeunload-warning"
import { useInternalNavigationGuard } from "@/hooks/use-internal-navigation-guard"
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
  let result = html.replace(/^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+/gi, "")
  result = result.replace(/(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+$/gi, "")
  return result.trim()
}

interface EntryFormProps {
  topicId: string
  /** `onApiSuccess` — 200 OK anında çağrılır; navigasyon/router beklemeden loading kapatmak için. */
  onSubmit: (
    content: string,
    isAnonymous: boolean,
    onApiSuccess: () => void,
    poll?: EntryPollSubmission | null,
  ) => void | Promise<void>
  isLoggedIn: boolean
  onLoginClick: () => void
}

export function EntryForm({ topicId, onSubmit, isLoggedIn, onLoginClick }: EntryFormProps) {
  const router = useRouter()
  const [content, setContent] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState("")
  const [charCount, setCharCount] = useState(0)
  const [unsavedOpen, setUnsavedOpen] = useState(false)
  const [pendingNav, setPendingNav] = useState<string | null>(null)
  const [poll, setPoll] = useState<PollComposerValue | null>(null)

  const baselineRef = useRef({ content: "", anon: false, hasPoll: false })

  const hasContent = !!content.replace(/<[^>]*>/g, "").trim()
  const isOverLimit = charCount >= 100_000
  const pollReady = poll ? isPollValid(poll) : true
  const pollIncomplete = poll !== null && !pollReady
  // Anket varsa boş entry'ye izin verilir; yine de yayın için "anlamlı veri" gereklidir.
  const canPublish = (hasContent || (poll !== null && pollReady)) && !pollIncomplete

  useEffect(() => {
    setContent("")
    setIsAnonymous(false)
    setPoll(null)
    baselineRef.current = { content: "", anon: false, hasPoll: false }
    setError("")
  }, [topicId])

  const isDirty =
    trimComposerHtml(content) !== trimComposerHtml(baselineRef.current.content) ||
    isAnonymous !== baselineRef.current.anon ||
    (poll !== null) !== baselineRef.current.hasPoll

  const guardActive =
    isLoggedIn &&
    isDirty &&
    (hasMeaningfulComposerHtml(content) ||
      hasMeaningfulComposerHtml(baselineRef.current.content) ||
      poll !== null)

  useBeforeunloadWarning(guardActive)
  useInternalNavigationGuard(guardActive, (path) => {
    setPendingNav(path)
    setUnsavedOpen(true)
  })

  const performSubmit = async (): Promise<boolean> => {
    const finalContent = trimHtmlContent(
      (content ?? "").replace(/^[\s\n\r\u00a0\u200b]+/, "").replace(/[\s\n\r\u00a0\u200b]+$/, ""),
    )
    // Anket varsa boş entry kabul edilir.
    if (!finalContent && poll === null) return false
    if (poll !== null && !isPollValid(poll)) {
      setError(
        "Anket eksik. Soruyu doldurun ve en az 2 farklı seçenek girin (veya anketi kaldırın).",
      )
      return false
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

    setIsSubmitting(true)
    setError("")
    try {
      await onSubmit(finalContent, isAnonymous, () => setIsSubmitting(false), pollPayload)
      setContent("")
      setPoll(null)
      baselineRef.current = { content: "", anon: isAnonymous, hasPoll: false }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entry eklenemedi")
      setIsSubmitting(false)
      return false
    }
  }

  const handleSubmit = async () => {
    await performSubmit()
  }

  const performSaveDraft = async (): Promise<boolean> => {
    // Taslak kaydı için: ya anlamlı içerik, ya da en azından kısmen doldurulmuş bir anket olmalı.
    const draftPoll = buildDraftPollPayload(poll)
    if (!hasContent && draftPoll === null) return false
    if (isSavingDraft) return false

    const validTopicId =
      topicId &&
      topicId !== "00000000-0000-0000-0000-000000000000" &&
      topicId.trim() !== ""
    if (!validTopicId) {
      setError("Geçerli bir başlık seçili değil.")
      return false
    }

    setIsSavingDraft(true)
    setError("")
    try {
      const cleanContent = content
        .replace(/^\s+/, "")
        .replace(/\s+$/, "")
        .replace(/^\n+/, "")
        .replace(/\n+$/, "")
      const body: {
        topicId: string
        content: string
        isAnonymous?: boolean
        poll?: EntryPollSubmission
      } = {
        topicId,
        content: cleanContent.replace(/^[\s\n\r]+|[\s\n\r]+$/g, ""),
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
      if (res.status === 200 || res.status === 201) {
        setContent("")
        setPoll(null)
        baselineRef.current = { content: "", anon: isAnonymous, hasPoll: false }
        return true
      }
      return false
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Taslak kaydedilemedi")
      return false
    } finally {
      setIsSavingDraft(false)
    }
  }

  const handleSaveDraft = () => void performSaveDraft()

  const publishFromGuard = async () => {
    const nav = pendingNav
    setPendingNav(null)
    const ok = await performSubmit()
    setUnsavedOpen(false)
    if (ok && nav) router.push(nav)
  }

  const draftFromGuard = async () => {
    const nav = pendingNav
    setPendingNav(null)
    const ok = await performSaveDraft()
    setUnsavedOpen(false)
    if (ok && nav) router.push(nav)
  }

  if (!isLoggedIn) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 text-center">
        <p className="text-muted-foreground mb-3">
          Bu başlığa entry girmek için giriş yapmalısınız.
        </p>
        <Button
          onClick={onLoginClick}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          Giriş Yap
        </Button>
      </div>
    )
  }

  const draftPollAvailable = buildDraftPollPayload(poll) !== null
  const canSaveDraft = hasContent || draftPollAvailable

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-5 min-w-0 w-full max-w-full">
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="düşüncelerinizi yazın..."
          onCharCountChange={setCharCount}
          contentMinHeightClass="min-h-[180px]"
          poll={poll}
          onPollChange={setPoll}
          pollDisabled={isSubmitting}
        />
        <div className="mt-3 space-y-1">
          <RadioGroup
            value={isAnonymous ? "anonymous" : "account"}
            onValueChange={(v) => setIsAnonymous(v === "anonymous")}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="account" id="entry-account" />
              <Label htmlFor="entry-account" className="text-sm font-normal cursor-pointer">
                Kendi hesabınla paylaş
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="anonymous" id="entry-anonymous" />
              <Label htmlFor="entry-anonymous" className="text-sm font-normal cursor-pointer">
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

        {isOverLimit && (
          <p className="text-sm text-red-500 font-medium mt-2">
            Entry maksimum 100.000 karakter olabilir. Lütfen içeriği kısaltın.
          </p>
        )}
        {!isOverLimit && error && <p className="text-sm text-destructive mt-2">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50 mt-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            disabled={!canSaveDraft || isSavingDraft || isOverLimit}
            className="text-muted-foreground hover:text-foreground"
          >
            {isSavingDraft ? "Kaydediliyor..." : "Taslak Olarak Kaydet"}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canPublish || isSubmitting || isOverLimit}
            className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
          >
            {isSubmitting ? "Gönderiliyor..." : "Gönder"}
          </Button>
        </div>
      </div>

      <UnsavedChangesAlertDialog
        mode="compose-publish"
        open={unsavedOpen}
        onOpenChange={setUnsavedOpen}
        isPublishing={isSubmitting}
        isSavingDraft={isSavingDraft}
        publishDisabled={!canPublish || isOverLimit || isSavingDraft}
        saveDraftDisabled={!canSaveDraft || isOverLimit || isSubmitting}
        onPublish={publishFromGuard}
        onSaveDraft={draftFromGuard}
        onDiscard={() => {
          const nav = pendingNav
          setPendingNav(null)
          setContent("")
          setIsAnonymous(false)
          setPoll(null)
          baselineRef.current = { content: "", anon: false, hasPoll: false }
          setUnsavedOpen(false)
          if (nav) router.push(nav)
        }}
      />
    </>
  )
}
