"use client"

import { useState, useEffect } from "react"
import { getApiUrl, apiFetch } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  BADGE_ICON,
  BADGE_META,
  normalizeUserBadgeCollection,
  type BadgeType,
  type UserBadgeCollectionNormalized,
} from "@/lib/badge-config"

async function fetchUserBadges(userId: string): Promise<UserBadgeCollectionNormalized> {
  const res = await apiFetch(getApiUrl(`api/Badges/users/${userId}`))
  if (!res.ok) throw new Error(`user_badges_${res.status}`)
  const raw = (await res.json()) as Record<string, unknown>
  return normalizeUserBadgeCollection(raw)
}

interface ProfileBadgeChipProps {
  type: BadgeType
  count: number
}

function ProfileBadgeChip({ type, count }: ProfileBadgeChipProps) {
  const meta = BADGE_META.find((m) => m.type === type)
  if (!meta) return null

  return (
    <span
      title={`${meta.label} — ${count}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 ring-1 shadow-sm",
        "text-[10px] font-semibold tabular-nums leading-none",
        meta.colorClasses.bg,
        meta.colorClasses.ring,
      )}
      aria-label={`${meta.label}: ${count}`}
    >
      <BADGE_ICON className={cn("h-4 w-4 shrink-0", meta.colorClasses.icon)} aria-hidden />
      <span className={meta.colorClasses.icon}>{count}</span>
    </span>
  )
}

interface ProfileBadgeCollectionProps {
  userId: string
}

/**
 * Profil başlığı sağ üstünde kompakt rozet vitrinı.
 */
export function ProfileBadgeCollection({ userId }: ProfileBadgeCollectionProps) {
  const [collection, setCollection] = useState<UserBadgeCollectionNormalized | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchUserBadges(userId)
      .then((data) => {
        if (!cancelled) {
          setCollection(data)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  if (!loaded || !collection || collection.totalBadges === 0) return null

  const orderedGroups = BADGE_META.map((m) =>
    collection.groups.find((g) => g.badgeType === m.type),
  ).filter((g): g is NonNullable<typeof g> => g !== undefined && g.count > 0)

  if (orderedGroups.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1 justify-end items-start max-w-[min(100%,260px)]">
      <span className="sr-only">
        Kazanılan rozetler: toplam {collection.totalBadges}
      </span>
      {orderedGroups.map((g) => (
        <ProfileBadgeChip key={g.badgeType} type={g.badgeType} count={g.count} />
      ))}
    </div>
  )
}
