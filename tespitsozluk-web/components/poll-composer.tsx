"use client"

import { useEffect, useRef } from "react"
import { Plus, Trash2, X, BarChart3 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * PollComposer — Entry yazarken kullanılan anket oluşturma formu.
 *
 * Tasarım notu: Bu bileşen anket state'ini tam olarak `value` üzerinden yönetir
 * (controlled). Ebeveyn `null` tutarsa anket eklenmemiş demektir; `onChange`
 * ile `null` yapılarak anket tamamen kaldırılabilir.
 */
export type PollComposerValue = {
  question: string
  options: string[]
  allowMultiple: boolean
  allowUserOptions: boolean
}

export const POLL_MAX_OPTIONS = 100
export const POLL_MIN_OPTIONS = 2
export const POLL_OPTION_MAX_LEN = 300
export const POLL_QUESTION_MAX_LEN = 500

export function createEmptyPoll(): PollComposerValue {
  return {
    question: "",
    options: ["", ""],
    allowMultiple: false,
    allowUserOptions: false,
  }
}

/**
 * Yayın doğrulaması:
 *  - Soru zorunlu (boş olamaz).
 *  - En az 2 boş olmayan, benzersiz seçenek gerekir.
 *  - Soru ve seçenek metin uzunluk sınırları kontrol edilir.
 */
export function isPollValid(p: PollComposerValue): boolean {
  const trimmedQuestion = (p.question ?? "").trim()
  if (trimmedQuestion.length === 0) return false
  if (trimmedQuestion.length > POLL_QUESTION_MAX_LEN) return false
  const cleaned = p.options.map((o) => o.trim()).filter((o) => o.length > 0)
  if (cleaned.length < POLL_MIN_OPTIONS) return false
  if (cleaned.some((o) => o.length > POLL_OPTION_MAX_LEN)) return false
  const lower = cleaned.map((o) => o.toLocaleLowerCase("tr"))
  if (new Set(lower).size !== lower.length) return false
  return true
}

interface PollComposerProps {
  value: PollComposerValue
  onChange: (next: PollComposerValue) => void
  onRemove: () => void
  disabled?: boolean
  /**
   * `true` ise dış kart kenarlığı kaldırılır, anket bloğu doğrudan editör gövdesine gömülür.
   * WYSIWYG hissi için RichTextEditor içinde kullanılır.
   */
  seamless?: boolean
}

export function PollComposer({ value, onChange, onRemove, disabled, seamless }: PollComposerProps) {
  const optionRefs = useRef<Array<HTMLInputElement | null>>([])
  const pendingFocusRef = useRef<number | null>(null)

  useEffect(() => {
    if (pendingFocusRef.current !== null) {
      const idx = pendingFocusRef.current
      pendingFocusRef.current = null
      const el = optionRefs.current[idx]
      if (el) {
        el.focus()
      }
    }
  }, [value.options.length])

  const setQuestion = (q: string) =>
    onChange({ ...value, question: q.slice(0, POLL_QUESTION_MAX_LEN) })

  const setOption = (index: number, text: string) => {
    const next = value.options.slice()
    next[index] = text.slice(0, POLL_OPTION_MAX_LEN)
    onChange({ ...value, options: next })
  }

  const addOption = () => {
    if (value.options.length >= POLL_MAX_OPTIONS) {
      // Limit dolu — kullanıcıyı toast ile uyar; sayaç UI'da gizli olduğu için bu kritik geri bildirim.
      toast.warning(`Maksimum ${POLL_MAX_OPTIONS} seçenek ekleyebilirsiniz.`)
      return
    }
    pendingFocusRef.current = value.options.length
    onChange({ ...value, options: [...value.options, ""] })
  }

  const removeOption = (index: number) => {
    if (value.options.length <= POLL_MIN_OPTIONS) {
      // Minimum altına inmesine izin verme; yalnızca temizle.
      const next = value.options.slice()
      next[index] = ""
      onChange({ ...value, options: next })
      return
    }
    const next = value.options.filter((_, i) => i !== index)
    onChange({ ...value, options: next })
  }

  return (
    <div
      className={cn(
        "space-y-4",
        seamless
          ? "px-4 py-3"
          : "rounded-lg border border-border bg-background/30 p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Anket</div>
            <div className="text-xs text-muted-foreground leading-tight">
              {value.allowMultiple ? "Çoklu seçim" : "Tek seçim"}
              {value.allowUserOptions ? " · kullanıcı ekleyebilir" : ""}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          disabled={disabled}
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          aria-label="Anketi kaldır"
          title="Anketi kaldır"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="poll-question" className="text-xs text-muted-foreground">
          Soru
        </Label>
        <Input
          id="poll-question"
          value={value.question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ne sormak istiyorsun?"
          disabled={disabled}
          maxLength={POLL_QUESTION_MAX_LEN}
          className="h-9"
          required
        />
      </div>

      <div className="space-y-2">
        {value.options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
              {i + 1}
            </span>
            <Input
              ref={(el) => {
                optionRefs.current[i] = el
              }}
              value={opt}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Seçenek ${i + 1}`}
              disabled={disabled}
              maxLength={POLL_OPTION_MAX_LEN}
              className="h-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeOption(i)}
              disabled={disabled || value.options.length <= POLL_MIN_OPTIONS}
              className={cn(
                "h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive",
                value.options.length <= POLL_MIN_OPTIONS && "opacity-0 pointer-events-none",
              )}
              aria-label={`Seçenek ${i + 1}'i sil`}
              title="Seçeneği sil"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {/* Seçenek limit bilgisi (N/100) kullanıcıdan gizlendi.
            Limit aşımında toast ile uyarı verilir (addOption içinde). */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOption}
          disabled={disabled}
          className="w-full justify-center gap-1.5 border-dashed text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Seçenek Ekle
        </Button>
      </div>

      <div className="space-y-2 pt-2 border-t border-border/60">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="poll-multi" className="text-sm font-normal cursor-pointer">
            Birden fazla seçime izin ver
          </Label>
          <Switch
            id="poll-multi"
            checked={value.allowMultiple}
            onCheckedChange={(c) => onChange({ ...value, allowMultiple: c })}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="poll-user-opts" className="text-sm font-normal cursor-pointer">
            Kullanıcıların seçenek eklemesine izin ver
          </Label>
          <Switch
            id="poll-user-opts"
            checked={value.allowUserOptions}
            onCheckedChange={(c) => onChange({ ...value, allowUserOptions: c })}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  )
}
