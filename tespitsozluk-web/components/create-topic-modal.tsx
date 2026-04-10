"use client"

import { useState } from "react"
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

function trimHtmlContent(html: string): string {
  if (!html) return ''
  let result = html
    .replace(/^(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+/gi, '')
  result = result
    .replace(/(<p>\s*<\/p>|<p><br\s*\/?><\/p>|<br\s*\/?>|\s)+$/gi, '')
  return result.trim()
}

interface CreateTopicModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (title: string, firstEntry: string, isAnonymous?: boolean) => void | Promise<string | null>
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
  const [title, setTitle] = useState("")
  const [firstEntry, setFirstEntry] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [charCount, setCharCount] = useState(0)

  const hasContent = !!firstEntry.replace(/<[^>]*>/g, "").trim()
  const isOverLimit = charCount >= 100_000

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!hasContent || isOverLimit) return
    const titleParsed = topicTitleSchema.safeParse(normalizeTopicTitleForApi(title))
    if (!titleParsed.success) {
      setError(titleParsed.error.issues[0]?.message ?? "Geçersiz başlık")
      return
    }

    const finalContent = trimHtmlContent(
      (firstEntry ?? '').replace(/^[\s\n\r\u00a0\u200b]+/, '').replace(/[\s\n\r\u00a0\u200b]+$/, '')
    )

    if (!finalContent) return

    setIsLoading(true)
    setError("")
    try {
      await onCreate(titleParsed.data, finalContent, isAnonymous)
      setTitle("")
      setFirstEntry("")
      setCharCount(0)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative z-50 flex w-full min-h-[50vh] max-h-[min(92vh,900px)] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg",
          FEED_COLUMN_MAX_WIDTH_CLASS
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 pb-3 pt-4">
          <h2 className="text-xl font-semibold text-foreground">Yeni Başlık</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 min-w-0 max-w-full overflow-x-hidden overflow-y-auto box-border px-6 pb-5 pt-0">
          {!isLoggedIn ? (
            <div className="py-6 text-center">
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
                    toolbarStickyTopClass="top-0"
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
              <Button
                type="submit"
                disabled={
                  !normalizeTopicTitleForApi(title) ||
                  !hasContent ||
                  normalizeTopicTitleForApi(title).length > TOPIC_TITLE_MAX_LENGTH ||
                  isLoading ||
                  isOverLimit
                }
                className="h-10 w-full shrink-0 bg-foreground text-background hover:bg-foreground/90"
              >
                {isLoading ? "Oluşturuluyor..." : "Başlık Oluştur"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
