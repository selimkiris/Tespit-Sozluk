"use client"

import { BarChart3 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Taslakta saklanan anketin sade önizlemesi. Backend `DraftResponseDto.Poll`
 * (`CreatePollDto`) şeklinde geldiği için ID ve oy bilgisi yoktur — yayınlanmış
 * `PollDisplay`'in oy verilmemiş (pre-vote) görselliğini birebir taklit eder,
 * ancak interaktif oylama / seçenek ekleme aksiyonları yoktur.
 */
export type DraftPollPreviewData = {
  question?: string | null
  options?: string[] | null
  allowMultiple?: boolean
  allowUserOptions?: boolean
}

interface DraftPollPreviewProps {
  poll: DraftPollPreviewData | null | undefined
  className?: string
}

export function DraftPollPreview({ poll, className }: DraftPollPreviewProps) {
  if (!poll) return null

  const rawOptions = Array.isArray(poll.options) ? poll.options : []
  const options = rawOptions
    .map((o) => (typeof o === "string" ? o.trim() : ""))
    .filter((o) => o.length > 0)

  const hasQuestion = !!poll.question && poll.question.trim().length > 0
  if (!hasQuestion && options.length === 0) return null

  return (
    <div
      className={cn(
        "mt-3 rounded-xl border border-border bg-background/40 p-3 sm:p-4",
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          {hasQuestion ? (
            <div className="break-words text-sm font-semibold leading-snug">
              {poll.question}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">Anket (taslak)</div>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground/80">
            <span>{poll.allowMultiple ? "Çoklu seçim" : "Tek seçim"}</span>
            {poll.allowUserOptions && (
              <>
                <span>·</span>
                <span>Kullanıcılar seçenek ekleyebilir</span>
              </>
            )}
          </div>
        </div>
      </div>

      {options.length === 0 ? (
        <p className="text-xs italic text-muted-foreground">
          Henüz seçenek eklenmemiş.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {options.map((text, idx) => (
            <li key={`${idx}-${text}`}>
              <div
                className={cn(
                  "flex w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-left text-sm text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center border border-muted-foreground/50 bg-background",
                    poll.allowMultiple ? "rounded-[4px]" : "rounded-full",
                  )}
                />
                <span className="min-w-0 flex-1 break-words">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
