"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart3, Check, Plus, Users2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getApiUrl, apiFetch } from "@/lib/api"

export type ApiPollOption = {
  id: string
  text: string
  isUserAdded?: boolean
  isVotedByCurrentUser?: boolean
  voteCount?: number | null
  percent?: number | null
}

export type ApiPoll = {
  id: string
  question?: string | null
  allowMultiple: boolean
  allowUserOptions: boolean
  hasVoted: boolean
  totalVotes?: number | null
  ownerId?: string | null
  options: ApiPollOption[]
}

interface PollDisplayProps {
  poll: ApiPoll
  isLoggedIn: boolean
  onLoginClick?: () => void
}

const OPTION_MAX_LEN = 300

function votersLabel(n: number): string {
  return `${n} kişi oy verdi`
}

export function PollDisplay({ poll: initialPoll, isLoggedIn, onLoginClick }: PollDisplayProps) {
  const [poll, setPoll] = useState<ApiPoll>(initialPoll)
  const [pending, setPending] = useState<Set<string>>(new Set())
  const [isVoting, setIsVoting] = useState(false)
  const [isAddingOption, setIsAddingOption] = useState(false)
  const [newOptionText, setNewOptionText] = useState("")
  const [showAddInput, setShowAddInput] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPoll(initialPoll)
    setPending(new Set())
    setError(null)
  }, [initialPoll.id, initialPoll.hasVoted, initialPoll.options.length])

  const hasVoted = poll.hasVoted
  const showResults = hasVoted

  const totalOptionVotes = useMemo(() => {
    if (!showResults) return 0
    return poll.options.reduce((acc, o) => acc + (o.voteCount ?? 0), 0)
  }, [poll.options, showResults])

  const togglePending = (optionId: string) => {
    setError(null)
    setPending((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        if (!poll.allowMultiple) {
          next.clear()
        }
        next.add(optionId)
      }
      return next
    })
  }

  const submitVote = async () => {
    if (!isLoggedIn) {
      onLoginClick?.()
      return
    }
    if (pending.size === 0) return
    setIsVoting(true)
    setError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Polls/${poll.id}/vote`), {
        method: "POST",
        body: JSON.stringify({ optionIds: Array.from(pending) }),
      })
      if (res.status === 401) {
        onLoginClick?.()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : data.message ?? data.title ?? "Oy kullanılamadı",
        )
      }
      setPoll(data as ApiPoll)
      setPending(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oy kullanılamadı")
    } finally {
      setIsVoting(false)
    }
  }

  // NOT: "Oyumu geri al" özelliği kaldırıldı — verilen oylar kalıcıdır.

  const addOption = async () => {
    const text = newOptionText.trim()
    if (!text) return
    if (!isLoggedIn) {
      onLoginClick?.()
      return
    }
    setIsAddingOption(true)
    setError(null)
    try {
      const res = await apiFetch(getApiUrl(`api/Polls/${poll.id}/options`), {
        method: "POST",
        body: JSON.stringify({ text }),
      })
      if (res.status === 401) {
        onLoginClick?.()
        return
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof data === "string" ? data : data.message ?? data.title ?? "Seçenek eklenemedi",
        )
      }
      setPoll(data as ApiPoll)
      setNewOptionText("")
      setShowAddInput(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seçenek eklenemedi")
    } finally {
      setIsAddingOption(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          {poll.question ? (
            <div className="text-sm font-semibold leading-snug break-words">{poll.question}</div>
          ) : (
            <div className="text-xs text-muted-foreground">Anket</div>
          )}
          <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 mt-0.5 flex-wrap">
            {poll.allowMultiple && <span>Çoklu seçim</span>}
            {poll.allowMultiple && hasVoted && <span>·</span>}
            {hasVoted && typeof poll.totalVotes === "number" && (
              <span className="inline-flex items-center gap-1">
                <Users2 className="h-3 w-3" />
                {votersLabel(poll.totalVotes)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ul className="space-y-1.5">
        {poll.options.map((opt) => {
          const isSelectedPending = pending.has(opt.id)
          const isCurrentUserChoice = opt.isVotedByCurrentUser === true
          const percent = showResults ? opt.percent ?? 0 : 0
          const voteCount = showResults ? opt.voteCount ?? 0 : 0

          if (showResults) {
            return (
              <li key={opt.id}>
                <div
                  className={cn(
                    "relative w-full rounded-lg border px-3 py-2 overflow-hidden",
                    isCurrentUserChoice
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
                      isCurrentUserChoice ? "bg-primary/20" : "bg-muted-foreground/15",
                    )}
                    style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
                  />
                  <div className="relative flex items-center justify-between gap-3 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isCurrentUserChoice && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      <span
                        className={cn(
                          "text-sm break-words",
                          isCurrentUserChoice ? "font-semibold" : "font-normal",
                        )}
                      >
                        {opt.text}
                      </span>
                      {opt.isUserAdded && (
                        <span
                          className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0"
                          title="Bu seçenek bir kullanıcı tarafından eklendi"
                        >
                          kullanıcı
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                      <span className="text-muted-foreground">{voteCount}</span>
                      <span className="font-semibold min-w-[2.5rem] text-right">
                        %{Math.round(percent)}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            )
          }

          // Oy verilmemiş: minimal, sadece seçenekleri göster — yüzde/bar yok.
          return (
            <li key={opt.id}>
              <button
                type="button"
                onClick={() => togglePending(opt.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors min-w-0",
                  isSelectedPending
                    ? "border-primary/60 bg-primary/5 text-foreground"
                    : "border-border bg-muted/20 hover:bg-muted/40 text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-4 w-4 shrink-0 items-center justify-center border transition-colors",
                    poll.allowMultiple ? "rounded-[4px]" : "rounded-full",
                    isSelectedPending
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/50 bg-background",
                  )}
                >
                  {isSelectedPending && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 break-words flex-1">{opt.text}</span>
                {opt.isUserAdded && (
                  <span
                    className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0"
                    title="Bu seçenek bir kullanıcı tarafından eklendi"
                  >
                    kullanıcı
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {error && <p className="text-xs text-destructive mt-2">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {!hasVoted && (
            <Button
              type="button"
              size="sm"
              onClick={submitVote}
              disabled={isVoting || pending.size === 0}
              className="h-8"
            >
              {isVoting ? "Gönderiliyor..." : "Oyla"}
            </Button>
          )}
        </div>

        {poll.allowUserOptions && (
          <div className="flex items-center gap-2 min-w-0">
            {showAddInput ? (
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <Input
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value.slice(0, OPTION_MAX_LEN))}
                  placeholder="Yeni seçenek"
                  className="h-8 w-full sm:w-52 text-sm"
                  maxLength={OPTION_MAX_LEN}
                  disabled={isAddingOption}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addOption()
                    }
                    if (e.key === "Escape") {
                      setShowAddInput(false)
                      setNewOptionText("")
                    }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 px-2"
                  onClick={addOption}
                  disabled={isAddingOption || !newOptionText.trim()}
                >
                  {isAddingOption ? "..." : "Ekle"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => {
                    setShowAddInput(false)
                    setNewOptionText("")
                  }}
                  disabled={isAddingOption}
                >
                  İptal
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-dashed"
                onClick={() => {
                  if (!isLoggedIn) {
                    onLoginClick?.()
                    return
                  }
                  setShowAddInput(true)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Seçenek ekle
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
