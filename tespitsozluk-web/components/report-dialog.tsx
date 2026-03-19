"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { getApiUrl, getAuthHeaders } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const REPORT_REASONS = [
  { value: "Küfür / Hakaret", label: "Küfür / Hakaret" },
  { value: "Spam / Reklam", label: "Spam / Reklam" },
  { value: "Yasa Dışı İçerik", label: "Yasa Dışı İçerik" },
  { value: "Troll / Başlık Saptırma", label: "Troll / Başlık Saptırma" },
  { value: "Diğer", label: "Diğer" },
] as const

interface ReportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetId: string
  targetType: "entry" | "topic"
}

export function ReportDialog({
  open,
  onOpenChange,
  targetId,
  targetType,
}: ReportDialogProps) {
  const [reason, setReason] = useState<string>("")
  const [details, setDetails] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setDetails("")
    }
  }, [open])

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error("Lütfen bir şikayet sebebi seçin.")
      return
    }

    const entryId = targetType === "entry" ? targetId : undefined
    const topicId = targetType === "topic" ? targetId : undefined

    if (!entryId && !topicId) {
      toast.error("Geçersiz hedef.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(getApiUrl("api/Reports"), {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          entryId: entryId ?? null,
          topicId: topicId ?? null,
          reason: reason.trim(),
          details: details.trim() || null,
        }),
      })

      if (res.status === 401) {
        toast.error("Şikayet etmek için giriş yapmalısınız.")
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const msg = typeof data === "string" ? data : (data.message ?? "Şikayet gönderilemedi.")
        toast.error(msg)
        return
      }

      toast.success("Şikayetiniz yönetime iletildi. Teşekkür ederiz.")
      onOpenChange(false)
    } catch {
      toast.error("Şikayet gönderilemedi.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Şikayet Et</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="report-reason">Şikayet sebebi</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Sebep seçin..." />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-details">Detaylar (isteğe bağlı)</Label>
            <Textarea
              id="report-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Ek bilgi varsa yazabilirsiniz..."
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Gönderiliyor..." : "Gönder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
