"use client"

import { useState, useEffect, useCallback } from "react"
import { Info, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { getApiUrl, apiFetch } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  BADGE_ICON,
  BADGE_META,
  normalizeEntryBadgeSummary,
  type BadgeType,
  type BadgeMeta,
} from "@/lib/badge-config"

export type { BadgeType }

interface MonthlyBadgeUsageRow {
  entryId?: string | null
  assignedAtUtc?: string | null
}

interface MonthlyStatusItem {
  badgeType: BadgeType
  monthlyUsageCount?: number
  usagesThisMonth?: MonthlyBadgeUsageRow[]
  used?: boolean
  usedOnEntryId?: string | null
  usedAtUtc?: string | null
}

function monthlyUsageCountSafe(item: MonthlyStatusItem | undefined): number {
  if (typeof item?.monthlyUsageCount === "number") return item.monthlyUsageCount
  return item?.used ? 1 : 0
}

interface MonthlyStatusResponse {
  monthStartUtc: string
  nextResetUtc: string
  items: MonthlyStatusItem[]
}

type EntryBadgeSummaryNormalized = ReturnType<typeof normalizeEntryBadgeSummary>

interface CurrentUserBadgeGiver {
  id: string
  nickname: string
  avatar?: string | null
}

const REVOKE_WINDOW_MS = 15 * 60 * 1000

function normalizeGuid(s: string | null | undefined): string {
  return (s ?? "").replace(/-/g, "").toLowerCase()
}

function entryIdsEqual(a: string | null | undefined, b: string): boolean {
  const na = normalizeGuid(a)
  const nb = normalizeGuid(b)
  if (na.length === 32 && nb.length === 32 && na !== nb) return false
  return (a ?? "") === b || na === nb
}

function getMyAssignedAtForThisEntry(
  item: MonthlyStatusItem | undefined,
  entryId: string,
): string | null {
  const usages = item?.usagesThisMonth
  if (usages?.length) {
    const m = usages.find((u) => u.entryId && entryIdsEqual(u.entryId, entryId))
    if (m?.assignedAtUtc) return m.assignedAtUtc
  }
  if (item?.usedOnEntryId && item?.usedAtUtc && entryIdsEqual(item.usedOnEntryId, entryId)) {
    return item.usedAtUtc
  }
  return null
}

function isRevokeWindowClosed(assignedAtUtc: string | null): boolean {
  if (!assignedAtUtc) return false
  const t = new Date(assignedAtUtc).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t > REVOKE_WINDOW_MS
}

function applyToggleToEntrySummary(
  prev: EntryBadgeSummaryNormalized | null,
  type: BadgeType,
  isActive: boolean,
  totalForBadgeOnEntry: number,
  totalBadgesOnEntry: number,
  entryIdStr: string,
  self: CurrentUserBadgeGiver | undefined,
): EntryBadgeSummaryNormalized {
  const base: EntryBadgeSummaryNormalized =
    prev ?? {
      entryId: entryIdStr,
      totalsByType: {},
      totalBadges: 0,
      myBadges: [],
      giversByType: {},
    }

  const next: EntryBadgeSummaryNormalized = {
    ...base,
    entryId: base.entryId || entryIdStr,
    totalsByType: { ...base.totalsByType },
    giversByType: { ...base.giversByType },
    myBadges: [...base.myBadges],
  }

  if (totalForBadgeOnEntry <= 0) {
    delete next.totalsByType[type]
    delete next.giversByType[type]
  } else {
    next.totalsByType[type] = totalForBadgeOnEntry
    if (isActive && self) {
      const prevList = [...(next.giversByType[type] ?? [])]
      if (!prevList.some((g) => g.userId === self.id)) {
        prevList.push({
          userId: self.id,
          username: self.nickname ?? "",
          avatar: self.avatar ?? null,
        })
      }
      next.giversByType[type] = prevList
    } else if (!isActive && self) {
      const filtered = (next.giversByType[type] ?? []).filter((g) => g.userId !== self.id)
      if (filtered.length === 0) delete next.giversByType[type]
      else next.giversByType[type] = filtered
    }
  }

  if (isActive) {
    if (!next.myBadges.includes(type)) next.myBadges.push(type)
  } else {
    next.myBadges = next.myBadges.filter((t) => t !== type)
  }
  next.totalBadges = totalBadgesOnEntry
  return next
}

function patchMonthlyAfterToggle(
  prev: MonthlyStatusResponse | null,
  type: BadgeType,
  entryIdStr: string,
  isActive: boolean,
  nowIso: string,
): MonthlyStatusResponse | null {
  if (!prev) return prev
  return {
    ...prev,
    items: prev.items.map((it) =>
      it.badgeType !== type
        ? it
        : (() => {
            const prevUsages = [...(it.usagesThisMonth ?? [])]
            if (isActive) {
              prevUsages.push({ entryId: entryIdStr, assignedAtUtc: nowIso })
            } else {
              const idx = prevUsages.findIndex((u) =>
                u.entryId ? entryIdsEqual(u.entryId, entryIdStr) : false,
              )
              if (idx >= 0) prevUsages.splice(idx, 1)
            }
            const monthlyUsageCount = prevUsages.length
            const first = monthlyUsageCount > 0 ? prevUsages[0] : undefined
            return {
              ...it,
              usagesThisMonth: prevUsages,
              monthlyUsageCount,
              used: monthlyUsageCount > 0,
              usedOnEntryId: first?.entryId ?? null,
              usedAtUtc: first?.assignedAtUtc ?? null,
            }
          })(),
    ),
  }
}

async function fetchMonthlyStatus(): Promise<MonthlyStatusResponse> {
  const res = await apiFetch(getApiUrl("api/Badges/my-monthly-status"))
  if (!res.ok) throw new Error(`status_${res.status}`)
  return res.json() as Promise<MonthlyStatusResponse>
}

async function fetchEntrySummary(entryId: string): Promise<EntryBadgeSummaryNormalized> {
  const res = await apiFetch(getApiUrl(`api/Badges/entries/${entryId}`))
  if (!res.ok) throw new Error(`summary_${res.status}`)
  const raw = (await res.json()) as Record<string, unknown>
  return normalizeEntryBadgeSummary(raw)
}

async function toggleBadge(
  entryId: string,
  badgeType: BadgeType,
): Promise<{
  isActive: boolean
  totalBadgesOnEntry: number
  totalForBadgeOnEntry: number
}> {
  const res = await apiFetch(getApiUrl("api/Badges/toggle"), {
    method: "POST",
    body: JSON.stringify({ entryId, badgeType }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const msg =
      typeof data === "string"
        ? data
        : (data.message ?? data.title ?? "İşlem başarısız.")
    throw new Error(typeof msg === "string" ? msg : "İşlem başarısız.")
  }
  const raw = (await res.json()) as Record<string, unknown>
  const isActive =
    typeof raw.isActive === "boolean"
      ? raw.isActive
      : typeof raw.IsActive === "boolean"
        ? raw.IsActive
        : false
  const totalBadgesOnEntry =
    typeof raw.totalBadgesOnEntry === "number"
      ? raw.totalBadgesOnEntry
      : typeof raw.TotalBadgesOnEntry === "number"
        ? raw.TotalBadgesOnEntry
        : 0
  const totalForBadgeOnEntry =
    typeof raw.totalForBadgeOnEntry === "number"
      ? raw.totalForBadgeOnEntry
      : typeof raw.TotalForBadgeOnEntry === "number"
        ? raw.TotalForBadgeOnEntry
        : 0
  return { isActive, totalBadgesOnEntry, totalForBadgeOnEntry }
}

function formatResetDate(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return d.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

function hasMyBadgeOnThisEntry(summary: EntryBadgeSummaryNormalized | null, type: BadgeType): boolean {
  return summary?.myBadges.includes(type) ?? false
}

interface BadgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entryId: string
  isLoggedIn: boolean
  onLoginClick?: () => void
  onEntryBadgeSummaryUpdated?: (summary: EntryBadgeSummaryNormalized) => void
  currentUserBadgeGiver?: CurrentUserBadgeGiver | null
}

export function BadgeDialog({
  open,
  onOpenChange,
  entryId,
  isLoggedIn,
  onLoginClick,
  onEntryBadgeSummaryUpdated,
  currentUserBadgeGiver,
}: BadgeDialogProps) {
  const [monthlyStatus, setMonthlyStatus] = useState<MonthlyStatusResponse | null>(null)
  const [entrySummary, setEntrySummary] = useState<EntryBadgeSummaryNormalized | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [togglingType, setTogglingType] = useState<BadgeType | null>(null)

  const load = useCallback(async () => {
    if (!open) return
    setLoading(true)
    setLoadError(null)
    try {
      await Promise.all([
        fetchEntrySummary(entryId).then(setEntrySummary),
        isLoggedIn
          ? fetchMonthlyStatus().then(setMonthlyStatus).catch(() => setMonthlyStatus(null))
          : Promise.resolve(),
      ])
    } catch {
      setLoadError("Veriler yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [open, entryId, isLoggedIn])

  useEffect(() => {
    if (open) load()
    else {
      const t = setTimeout(() => {
        setMonthlyStatus(null)
        setEntrySummary(null)
        setLoadError(null)
        setTogglingType(null)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [open, load])

  const handleBadge = async (meta: BadgeMeta) => {
    if (!isLoggedIn) {
      onOpenChange(false)
      onLoginClick?.()
      return
    }

    const mineHere = hasMyBadgeOnThisEntry(entrySummary, meta.type)
    const monthlyItem = monthlyStatus?.items.find((i) => i.badgeType === meta.type)
    const monthlyCount = monthlyUsageCountSafe(monthlyItem)
    const quotaSlotsFullElsewhere = !mineHere && monthlyCount >= 2

    if (quotaSlotsFullElsewhere) return

    const assignedAtUtc = getMyAssignedAtForThisEntry(monthlyItem, entryId)
    const revokeLocked = mineHere && isRevokeWindowClosed(assignedAtUtc ?? null)

    if (mineHere && revokeLocked) return
    if (togglingType !== null) return
    setTogglingType(meta.type)

    try {
      const result = await toggleBadge(entryId, meta.type)
      const nowIso = new Date().toISOString()
      const nextMonthly = patchMonthlyAfterToggle(monthlyStatus, meta.type, entryId, result.isActive, nowIso)
      const nextSummary = applyToggleToEntrySummary(
        entrySummary,
        meta.type,
        result.isActive,
        result.totalForBadgeOnEntry,
        result.totalBadgesOnEntry,
        entryId,
        currentUserBadgeGiver ?? undefined,
      )
      if (nextMonthly) setMonthlyStatus(nextMonthly)
      setEntrySummary(nextSummary)
      onEntryBadgeSummaryUpdated?.(nextSummary)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "İşlem başarısız.")
    } finally {
      setTogglingType(null)
    }
  }

  const nextReset = monthlyStatus ? formatResetDate(monthlyStatus.nextResetUtc) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-full p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-semibold tracking-tight">
            Rozet Tak
          </DialogTitle>
        </DialogHeader>

        <div className="mx-5 mb-3 rounded-lg border border-blue-500/25 bg-blue-500/8 px-4 py-3">
          <div className="flex gap-2.5">
            <Info className="h-4 w-4 text-blue-400 shrink-0 mt-[1px]" />
            <ul className="text-[12.5px] text-blue-200/80 space-y-0.5 leading-relaxed list-none m-0 p-0">
              <li>
                Bir ayda{" "}
                <strong className="font-semibold text-blue-200">her rozetten en fazla 2 adet</strong>{" "}
                takabilirsin, artan rozetlerin devretmez.
              </li>
              <li>
                Rozetler her ayın 1&apos;inde yenilenir
                {nextReset ? (
                  <>
                    {" "}
                    — sonraki: <span className="text-blue-200">{nextReset}</span>
                  </>
                ) : (
                  "."
                )}
              </li>
              <li>
                Takılan rozet yalnızca{" "}
                <strong className="text-blue-200">ilk 15 dakika</strong> içinde geri
                alınabilir.
              </li>
            </ul>
          </div>
        </div>

        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : loadError ? (
            <p className="text-center text-sm text-destructive/80 py-6">{loadError}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 items-stretch auto-rows-fr">
              {BADGE_META.map((meta) => {
                const statusItem = monthlyStatus?.items.find((i) => i.badgeType === meta.type)
                const mineHere = hasMyBadgeOnThisEntry(entrySummary, meta.type)
                const monthlyCount = monthlyUsageCountSafe(statusItem)
                const quotaSlotsFullElsewhere =
                  isLoggedIn && !mineHere && monthlyCount >= 2
                const isToggling = togglingType === meta.type

                const assignedAtUtc = getMyAssignedAtForThisEntry(statusItem, entryId)
                const revokeLocked = mineHere && isRevokeWindowClosed(assignedAtUtc ?? null)
                const grayCell = quotaSlotsFullElsewhere || mineHere
                const disabled =
                  quotaSlotsFullElsewhere || isToggling || (mineHere && revokeLocked)
                const showGeriAlText =
                  mineHere && !quotaSlotsFullElsewhere && !revokeLocked
                const remainingThisType =
                  isLoggedIn ? Math.max(0, 2 - monthlyCount) : 2

                return (
                  <button
                    key={meta.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => void handleBadge(meta)}
                    title={
                      quotaSlotsFullElsewhere
                        ? `"${meta.label}" rozetini bu ay zaten iki kez kullandınız.`
                        : mineHere && revokeLocked
                          ? "15 dakikalık süre geçti; bu rozeti geri alamazsınız."
                          : mineHere
                            ? `${meta.label} — geri almak için tıklayın`
                            : meta.description
                    }
                    className={cn(
                      "group relative isolate flex flex-col items-stretch rounded-lg px-2 py-2 transition-all duration-150",
                      "min-h-[102px] h-full ring-1 text-center select-none overflow-visible",
                      "[&:disabled]:cursor-default",
                      grayCell
                        ? cn(
                            "bg-muted/10 ring-border/40 cursor-default",
                            mineHere && !quotaSlotsFullElsewhere && !revokeLocked
                              ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                              : "",
                          )
                        : cn(
                            meta.colorClasses.ring,
                            "cursor-pointer hover:scale-[1.03] active:scale-[0.97]",
                            meta.colorClasses.hover,
                          ),
                    )}
                    aria-label={
                      mineHere && !revokeLocked ? `${meta.label} — geri al` : meta.label
                    }
                  >
                    {isLoggedIn && (
                      <span
                        className={cn(
                          "pointer-events-none absolute -top-0.5 -right-0.5 z-[8] flex min-w-[20px] h-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums shadow-sm ring-1",
                          quotaSlotsFullElsewhere || mineHere
                            ? "bg-muted/95 text-muted-foreground ring-border/50"
                            : cn(meta.colorClasses.pill, "ring-white/15"),
                        )}
                        aria-hidden
                      >
                        {remainingThisType}
                      </span>
                    )}

                    {showGeriAlText && (
                      <span
                        className="absolute top-1 left-1 right-1 z-20 pointer-events-none text-center text-[11px] font-bold text-red-500 underline underline-offset-2 transition-colors group-hover:text-red-600 drop-shadow-[0_1px_1px_rgb(28,28,29)]"
                        aria-hidden
                      >
                        GERİ AL
                      </span>
                    )}

                    <div
                      className={cn(
                        "relative z-0 flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[10px] px-1.5 pt-6 pb-1.5",
                        grayCell
                          ? "-mx-px -my-px grayscale opacity-[0.62] saturate-75"
                          : meta.colorClasses.bg,
                      )}
                    >
                      <span
                        className={cn(
                          "relative z-10 flex shrink-0 items-center justify-center rounded-full w-8 h-8",
                          grayCell ? "bg-muted/40" : "bg-black/15",
                        )}
                      >
                        {isToggling ? (
                          <Loader2
                            className={cn(
                              "h-[18px] w-[18px] animate-spin",
                              grayCell ? "text-muted-foreground" : meta.colorClasses.icon,
                            )}
                            aria-hidden
                          />
                        ) : (
                          <BADGE_ICON
                            className={cn(
                              "h-[18px] w-[18px] shrink-0",
                              grayCell ? "text-muted-foreground" : meta.colorClasses.icon,
                            )}
                            aria-hidden
                          />
                        )}
                      </span>

                      <span
                        className={cn(
                          "relative z-10 px-0.5 text-[10px] font-semibold leading-tight line-clamp-2",
                          grayCell ? "text-muted-foreground" : "text-foreground/95",
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {!isLoggedIn && !loading && !loadError && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Rozet takmak için{" "}
              <button
                type="button"
                className="text-primary underline underline-offset-2"
                onClick={() => {
                  onOpenChange(false)
                  onLoginClick?.()
                }}
              >
                giriş yapın
              </button>
              .
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
