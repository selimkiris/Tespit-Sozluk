"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/rich-text-editor"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { getApiUrl, getAuthHeaders } from "@/lib/api"

function trimHtmlContent(html: string): string {
  if (!html) return ''
  let result = html
    .replace(/^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+/gi, '')
  result = result
    .replace(/(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+$/gi, '')
  return result.trim()
}

interface EntryFormProps {
  topicId: string
  /** `onApiSuccess` — 200 OK anında çağrılır; navigasyon/router beklemeden loading kapatmak için. */
  onSubmit: (content: string, isAnonymous: boolean, onApiSuccess: () => void) => void | Promise<void>
  isLoggedIn: boolean
  onLoginClick: () => void
}

export function EntryForm({ topicId, onSubmit, isLoggedIn, onLoginClick }: EntryFormProps) {
  const [content, setContent] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [error, setError] = useState("")
  const [charCount, setCharCount] = useState(0)

  const hasContent = !!content.replace(/<[^>]*>/g, "").trim()
  const isOverLimit = charCount >= 100_000

  const handleSubmit = async () => {
    const finalContent = trimHtmlContent(
      (content ?? '').replace(/^[\s\n\r\u00a0\u200b]+/, '').replace(/[\s\n\r\u00a0\u200b]+$/, '')
    )

    if (!finalContent) return

    setIsSubmitting(true)
    setError("")
    try {
      await onSubmit(finalContent, isAnonymous, () => setIsSubmitting(false))
      setContent("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entry eklenemedi")
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!hasContent) return
    if (isSavingDraft) return

    const validTopicId =
      topicId &&
      topicId !== "00000000-0000-0000-0000-000000000000" &&
      topicId.trim() !== ""
    if (!validTopicId) {
      setError("Geçerli bir başlık seçili değil.")
      return
    }

    setIsSavingDraft(true)
    setError("")
    try {
      const cleanContent = content
        .replace(/^\s+/, '')
        .replace(/\s+$/, '')
        .replace(/^\n+/, '')
        .replace(/\n+$/, '')
      const body: { topicId: string; content: string; isAnonymous?: boolean } = {
        topicId,
        content: cleanContent.replace(/^[\s\n\r]+|[\s\n\r]+$/g, ''),
        isAnonymous,
      }
      // Mevcut başlık sayfasındayız - newTopicTitle kesinlikle gönderilmez
      const res = await fetch(getApiUrl("api/Drafts"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data === "string" ? data : data.message ?? data.title ?? "Taslak kaydedilemedi"
        throw new Error(msg)
      }
      if (res.status === 200 || res.status === 201) {
        alert("Taslak başarıyla oluşturuldu")
        setContent("")
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : "Taslak kaydedilemedi")
    } finally {
      setIsSavingDraft(false)
    }
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

  return (
    <div className="bg-card border border-border rounded-lg p-5 min-w-0 w-full max-w-full">
      <RichTextEditor
        value={content}
        onChange={setContent}
        placeholder="düşüncelerinizi yazın..."
        onCharCountChange={setCharCount}
        contentMinHeightClass="min-h-[180px]"
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
      <div className="flex justify-end items-center gap-2 pt-3 border-t border-border/50 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveDraft}
          disabled={!hasContent || isSavingDraft || isOverLimit}
          className="text-muted-foreground hover:text-foreground"
        >
          {isSavingDraft ? "Kaydediliyor..." : "Taslak Olarak Kaydet"}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!hasContent || isSubmitting || isOverLimit}
          className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          {isSubmitting ? "Gönderiliyor..." : "Gönder"}
        </Button>
      </div>
    </div>
  )
}
