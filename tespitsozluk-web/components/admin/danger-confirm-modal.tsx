"use client"

import { useState, useEffect, useRef } from "react"
import { AlertTriangle, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DangerConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  warningText: string
  /** Kullanıcının yazması gereken tam metin */
  expectedText: string
  confirmLabel?: string
  isLoading?: boolean
}

export function DangerConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  warningText,
  expectedText,
  confirmLabel = "Kalıcı Olarak Sil",
  isLoading = false,
}: DangerConfirmModalProps) {
  const [inputValue, setInputValue] = useState("")
  const [isExecuting, setIsExecuting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const isMatched = inputValue === expectedText
  const busy = isLoading || isExecuting

  useEffect(() => {
    if (isOpen) {
      setInputValue("")
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = async () => {
    if (!isMatched || busy) return
    setIsExecuting(true)
    try {
      await onConfirm()
    } finally {
      setIsExecuting(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose()
    if (e.key === "Enter" && isMatched && !busy) handleConfirm()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKey}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-md animate-in fade-in-0 zoom-in-95 duration-200">
        <div className="rounded-xl border border-destructive/40 bg-card shadow-2xl overflow-hidden">
          {/* Kırmızı üst şerit */}
          <div className="h-1 w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600" />

          <div className="p-6">
            {/* Başlık */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20">
                  <ShieldAlert className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
                  <p className="text-xs text-destructive font-medium mt-0.5">Bu işlem geri alınamaz</p>
                </div>
              </div>
              <button
                onClick={() => !busy && onClose()}
                disabled={busy}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Uyarı kutusu */}
            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3.5">
              <div className="flex gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <p className="text-sm text-foreground/90 leading-relaxed">{warningText}</p>
              </div>
            </div>

            {/* Onay girişi */}
            <div className="space-y-2.5 mb-5">
              <p className="text-sm text-muted-foreground">
                Onaylamak için aşağıya{" "}
                <code className="rounded bg-destructive/10 px-1.5 py-0.5 text-destructive font-mono text-xs border border-destructive/20">
                  {expectedText}
                </code>{" "}
                yazın:
              </p>
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={expectedText}
                disabled={busy}
                className={cn(
                  "font-mono transition-colors",
                  inputValue.length > 0 && !isMatched
                    ? "border-destructive/60 focus-visible:ring-destructive/30 bg-destructive/5"
                    : isMatched
                    ? "border-green-500/60 focus-visible:ring-green-500/30 bg-green-500/5"
                    : ""
                )}
              />
              {inputValue.length > 0 && !isMatched && (
                <p className="text-xs text-destructive">Tam olarak eşleşmesi gerekiyor.</p>
              )}
            </div>

            {/* Butonlar */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={busy}
                className="h-9"
              >
                İptal
              </Button>
              <Button
                disabled={!isMatched || busy}
                onClick={handleConfirm}
                className={cn(
                  "h-9 gap-2 font-medium transition-all",
                  isMatched
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm shadow-destructive/20"
                    : "opacity-50 cursor-not-allowed bg-destructive/50 text-destructive-foreground"
                )}
              >
                {busy ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    İşleniyor...
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
