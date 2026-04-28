"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { getApiUrl, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  BADGE_ICON,
  BADGE_META,
  normalizeEntryBadgeSummary,
  type BadgeType,
  type BadgeGiverParsed,
} from "@/lib/badge-config"

// ---------- API ------------------------------------------------------------

async function fetchEntryBadgeSummary(entryId: string) {
  const res = await apiFetch(getApiUrl(`api/Badges/entries/${entryId}`))
  if (!res.ok) throw new Error(`badge_summary_${res.status}`)
  const raw = (await res.json()) as Record<string, unknown>
  return normalizeEntryBadgeSummary(raw)
}

// ---------- Giver Avatar ---------------------------------------------------

function GiverAvatar({ giver }: { giver: BadgeGiverParsed }) {
  if (giver.avatar?.startsWith("http")) {
    return (
      <img
        src={giver.avatar}
        alt=""
        referrerPolicy="no-referrer"
        className="h-6 w-6 rounded-full object-cover border border-border/50 shrink-0"
      />
    )
  }
  if (giver.avatar) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/80 text-sm border border-border/50">
        {giver.avatar}
      </span>
    )
  }
  return (
    <Avatar className="h-6 w-6 shrink-0">
      <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
        {(giver.username?.slice(0, 2) ?? "??").toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}

// ---------- Single Badge Pill with Popover ----------------------------------

interface BadgePillProps {
  type: BadgeType
  count: number
  givers: BadgeGiverParsed[]
}

function BadgePill({ type, count, givers }: BadgePillProps) {
  const meta = BADGE_META.find((m) => m.type === type)
  if (!meta) return null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`${meta.label} (${count})`}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-full",
            "ring-2 shadow-sm cursor-pointer transition-all duration-150 text-[11px] font-semibold leading-none",
            "hover:scale-[1.03] active:scale-[0.98]",
            "z-[5]",
            meta.colorClasses.bg,
            meta.colorClasses.ring,
            meta.colorClasses.hover,
          )}
          aria-label={`${meta.label}: ${count} rozet`}
        >
          <BADGE_ICON
            className={cn("h-3.5 w-3.5 shrink-0", meta.colorClasses.icon)}
            aria-hidden
          />
          <span className={cn("tabular-nums", meta.colorClasses.icon)}>{count}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-56 p-3 shadow-xl z-[60]"
      >
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border/50">
          <span
            className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full",
              meta.colorClasses.bg,
            )}
          >
            <BADGE_ICON className={cn("h-3.5 w-3.5", meta.colorClasses.icon)} aria-hidden />
          </span>
          <span className="text-[12px] font-semibold text-foreground leading-tight">
            {meta.label}
          </span>
          <span
            className={cn(
              "ml-auto text-[10px] font-bold rounded-full px-1.5 py-0.5",
              meta.colorClasses.pill,
            )}
          >
            {count}
          </span>
        </div>

        {givers.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-1">
            Veren listesi yüklenemedi.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {givers.map((g) => (
              <li key={g.userId}>
                <Link
                  href={`/user/${g.userId}`}
                  className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60 transition-colors"
                >
                  <GiverAvatar giver={g} />
                  <span className="text-[12px] font-medium text-foreground truncate">
                    {g.username || "Kullanıcı"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

// ---------- Main Component -------------------------------------------------

interface EntryBadgePillsProps {
  entryId: string
  /** Dialog’dan güncellenen özet — anında hapları yeniden boyar */
  optimisticSummary?:
    | ReturnType<typeof normalizeEntryBadgeSummary>
    | null
}

export function EntryBadgePills({ entryId, optimisticSummary }: EntryBadgePillsProps) {
  const [summary, setSummary] = useState<ReturnType<
    typeof normalizeEntryBadgeSummary
  > | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchEntryBadgeSummary(entryId)
      .then((data) => {
        if (!cancelled) setSummary(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [entryId])

  const display = optimisticSummary ?? summary

  if (!display || display.totalBadges === 0) return null

  const activePills = BADGE_META.filter((m) => (display.totalsByType[m.type] ?? 0) > 0).map(
    (m) => ({
      meta: m,
      count: display.totalsByType[m.type]!,
      givers: display.giversByType[m.type] ?? [],
    }),
  )

  if (activePills.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 justify-end items-start content-start">
      {activePills.map(({ meta, count, givers }) => (
        <BadgePill key={meta.type} type={meta.type} count={count} givers={givers} />
      ))}
    </div>
  )
}
