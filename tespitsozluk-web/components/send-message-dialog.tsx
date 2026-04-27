"use client"

import { useState, useEffect, useCallback } from "react"
import { FileText, Hash, MessageCircle } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { MessageBodyEditor } from "@/components/message-body-editor"
import { cn } from "@/lib/utils"
import { MAX_PRIVATE_MESSAGE_LEN } from "@/lib/messaging"

const MAX_LEN = MAX_PRIVATE_MESSAGE_LEN

function plainSnippetFromHtml(html: string, max = 120): string {
  if (!html) return ""
  const t = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (t.length <= max) return t
  return `${t.slice(0, max).replace(/\s+\S*$/u, "")}…`
}

export type SendMessageReference =
  | {
      kind: "entry"
      entryId: string
      topicId: string
      topicTitle: string
      topicSlug?: string | null
      bodyHtml: string
      hasPoll?: boolean
    }
  | {
      kind: "topic"
      topicId: string
      title: string
      slug?: string | null
    }

export type SendMessageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recipientId: string
  recipientDisplayName: string
  reference?: SendMessageReference | null
}

export function SendMessageDialog({
  open,
  onOpenChange,
  recipientId,
  recipientDisplayName,
  reference,
}: SendMessageDialogProps) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [unsavedCloseOpen, setUnsavedCloseOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setText("")
      setUnsavedCloseOpen(false)
    }
  }, [open])

  const hasDraft = text.trim().length > 0

  const tryClose = useCallback(() => {
    if (hasDraft) {
      setUnsavedCloseOpen(true)
      return
    }
    onOpenChange(false)
  }, [hasDraft, onOpenChange])

  const handleRootOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true)
        return
      }
      tryClose()
    },
    [onOpenChange, tryClose],
  )

  const submitMessage = useCallback(async () => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setSending(true)
    try {
      const payload: {
        recipientId: string
        content: string
        referencedEntryId?: string | null
        referencedTopicId?: string | null
      } = {
        recipientId,
        content: trimmed,
      }
      if (reference?.kind === "entry") {
        payload.referencedEntryId = reference.entryId
      } else if (reference?.kind === "topic") {
        payload.referencedTopicId = reference.topicId
      }

      const res = await apiFetch(getApiUrl("api/Messages"), {
        method: "POST",
        body: JSON.stringify(payload),
      })

      if (res.status === 403) {
        await res.json().catch(() => ({}))
        toast.error("Bu yazara mesaj gönderemezsiniz")
        setUnsavedCloseOpen(false)
        onOpenChange(false)
        return
      }

      if (!res.ok) {
        setUnsavedCloseOpen(false)
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        throw new Error(data?.message ?? "Mesaj gönderilemedi.")
      }

      toast.success("Mesajınız gönderildi.")
      setUnsavedCloseOpen(false)
      onOpenChange(false)
    } catch (err) {
      setUnsavedCloseOpen(false)
      toast.error(err instanceof Error ? err.message : "Mesaj gönderilemedi.")
    } finally {
      setSending(false)
    }
  }, [sending, text, onOpenChange, reference, recipientId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void submitMessage()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleRootOpenChange}>
        <DialogContent
          showCloseButton
          onPointerDownOutside={(e) => {
            if (hasDraft) {
              e.preventDefault()
              setUnsavedCloseOpen(true)
            }
          }}
          onEscapeKeyDown={(e) => {
            if (hasDraft) {
              e.preventDefault()
              setUnsavedCloseOpen(true)
            }
          }}
          className={cn(
            "flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col gap-0 overflow-hidden border-border/80 p-0 shadow-lg",
          )}
        >
          <div className="shrink-0 p-6 pb-3">
            <DialogHeader>
              <DialogTitle className="flex items-start gap-3 pr-2 text-left">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold leading-tight">Mesaj gönder</span>
                  <span className="block break-words text-sm font-normal text-muted-foreground">
                    Alıcı: <span className="font-medium text-foreground">{recipientDisplayName}</span>
                  </span>
                </span>
              </DialogTitle>
            </DialogHeader>
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-2 [scrollbar-gutter:stable]">
              {reference?.kind === "entry" && (
                <div
                  className={cn(
                    "space-y-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-sm",
                  )}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Entry üzerine konuş
                  </p>
                  <div className="flex min-w-0 items-start gap-2.5">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 space-y-1.5">
                      {reference.topicTitle ? (
                        <p className="text-sm font-medium text-foreground break-words">
                          {reference.topicTitle}
                        </p>
                      ) : null}
                      {reference.hasPoll ? (
                        <p className="text-xs italic text-muted-foreground/90">*(Burada anket var)*</p>
                      ) : null}
                      {plainSnippetFromHtml(reference.bodyHtml) ? (
                        <p className="break-words border-l-2 border-primary/30 pl-2 text-xs text-muted-foreground/90 line-clamp-4">
                          {plainSnippetFromHtml(reference.bodyHtml)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}

              {reference?.kind === "topic" && (
                <div
                  className="space-y-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Başlık üzerine konuş
                  </p>
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Hash className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="min-w-0 break-words text-sm font-medium text-foreground">
                      {reference.title}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Mesajın</p>
                <MessageBodyEditor
                  inputKey={open ? "open" : "closed"}
                  value={text}
                  onChange={(v) => setText(v.slice(0, MAX_LEN))}
                  disabled={sending}
                  placeholder="Mesajınızı buraya yazın…"
                  minHeightClass="min-h-[140px] max-h-[40vh]"
                />
              </div>
            </div>

            <div className="shrink-0 space-y-0 border-t border-border/60 bg-background p-6 pt-4">
              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={tryClose}
                  disabled={sending}
                >
                  İptal
                </Button>
                <Button type="submit" disabled={sending || !text.trim()} className="gap-1.5">
                  {sending ? "Gönderiliyor…" : "Gönder"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={unsavedCloseOpen} onOpenChange={setUnsavedCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Henüz gönderilmedi</AlertDialogTitle>
            <AlertDialogDescription>
              Mesajınız henüz gönderilmedi. Kapatmak istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid gap-2 sm:grid-cols-3 sm:justify-stretch sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setUnsavedCloseOpen(false)}
            >
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setText("")
                setUnsavedCloseOpen(false)
                onOpenChange(false)
              }}
            >
              Kapat
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!text.trim() || sending) {
                  return
                }
                await submitMessage()
              }}
              disabled={sending || !text.trim()}
            >
              {sending ? "Gönderiliyor…" : "Gönder"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
