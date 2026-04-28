/**
 * Rozet sistemi paylaşılan meta verisi.
 * BadgeType enum değerleri C# BadgeType (byte) ile birebir eşleşir.
 * Tüm rozetler aynı ikon şeklini (Award) kullanır; ayırt edici yalnızca renk paletidir.
 */

import { Award } from "lucide-react"

/** Tüm rozet UI'larında kullanılan tek tip Lucide ikonu. */
export const BADGE_ICON = Award

/** C# `BadgeType` enum adları — JSON sözlük anahtarı olarak gelebilir. */
const CSHARP_BADGE_ENUM_NAMES = [
  "EnKomik",
  "IyiAnlatim",
  "Bilgilendirici",
  "IyiTespit",
  "Cesur",
  "Felsefi",
  "Samimi",
] as const

/** C# `BadgeType` enum değerleriyle birebir eşleşen numerik tip. */
export type BadgeType = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface BadgeMeta {
  type: BadgeType
  /** Türkçe görünen ad */
  label: string
  /** Kısa açıklama (tooltip / modal) — emoji yok */
  description: string
  colorClasses: {
    icon: string
    bg: string
    ring: string
    hover: string
    pill: string
  }
}

export const BADGE_META: BadgeMeta[] = [
  {
    type: 0,
    label: "En Komik",
    description: "Güldürdü",
    colorClasses: {
      icon: "text-amber-400",
      bg: "bg-amber-400/15",
      ring: "ring-amber-400/40",
      hover: "hover:bg-amber-400/25 hover:ring-amber-400/60",
      pill: "bg-amber-400/20 text-amber-300",
    },
  },
  {
    type: 1,
    label: "En İyi Anlatım",
    description: "Çok güzel anlattı",
    colorClasses: {
      icon: "text-emerald-400",
      bg: "bg-emerald-400/15",
      ring: "ring-emerald-400/40",
      hover: "hover:bg-emerald-400/25 hover:ring-emerald-400/60",
      pill: "bg-emerald-400/20 text-emerald-300",
    },
  },
  {
    type: 2,
    label: "En Bilgilendirici",
    description: "Öğretici bilgi",
    colorClasses: {
      icon: "text-blue-400",
      bg: "bg-blue-400/15",
      ring: "ring-blue-400/40",
      hover: "hover:bg-blue-400/25 hover:ring-blue-400/60",
      pill: "bg-blue-400/20 text-blue-300",
    },
  },
  {
    type: 3,
    label: "En İyi Tespit",
    description: "Tam isabet",
    colorClasses: {
      icon: "text-violet-400",
      bg: "bg-violet-400/15",
      ring: "ring-violet-400/40",
      hover: "hover:bg-violet-400/25 hover:ring-violet-400/60",
      pill: "bg-violet-400/20 text-violet-300",
    },
  },
  {
    type: 4,
    label: "En Cesur",
    description: "Cesurca dile getirdi",
    colorClasses: {
      icon: "text-rose-400",
      bg: "bg-rose-400/15",
      ring: "ring-rose-400/40",
      hover: "hover:bg-rose-400/25 hover:ring-rose-400/60",
      pill: "bg-rose-400/20 text-rose-300",
    },
  },
  {
    type: 5,
    label: "En Felsefi",
    description: "Düşündürdü",
    colorClasses: {
      icon: "text-orange-400",
      bg: "bg-orange-400/15",
      ring: "ring-orange-400/40",
      hover: "hover:bg-orange-400/25 hover:ring-orange-400/60",
      pill: "bg-orange-400/20 text-orange-300",
    },
  },
]

/** Numerik türe göre meta bilgisi döner; bilinmeyen tür için null. */
export function getBadgeMeta(type: number): BadgeMeta | null {
  return BADGE_META.find((m) => m.type === type) ?? null
}

/** Ham API nesnesinden `totalsByType` okur (anahtar: 0–6 veya C# enum adı). */
export function parseTotalsByType(raw: unknown): Partial<Record<BadgeType, number>> {
  if (raw === null || raw === undefined || typeof raw !== "object") return {}
  const out: Partial<Record<BadgeType, number>> = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const n = typeof val === "number" ? val : Number(val)
    if (!Number.isFinite(n) || n <= 0) continue
    let t: BadgeType | undefined
    if (/^\d+$/.test(key)) {
      const idx = Number.parseInt(key, 10)
      if (idx >= 0 && idx <= 6) t = idx as BadgeType
    } else {
      const enumIdx = CSHARP_BADGE_ENUM_NAMES.indexOf(
        key as (typeof CSHARP_BADGE_ENUM_NAMES)[number],
      )
      if (enumIdx >= 0) t = enumIdx as BadgeType
    }
    if (t !== undefined) out[t] = n
  }
  return out
}

export interface BadgeGiverParsed {
  userId: string
  username: string
  avatar: string | null
}

/** `giversByType` sözlüğünü güvenli şekilde parse eder; PascalCase property için de uyumludur. */
export function parseGiversByType(raw: unknown): Partial<Record<BadgeType, BadgeGiverParsed[]>> {
  let data: unknown = raw
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>
    if ("giversByType" in o || "GiversByType" in o) {
      data = o.giversByType ?? o.GiversByType
    }
  }
  if (data === null || data === undefined || typeof data !== "object") return {}

  const out: Partial<Record<BadgeType, BadgeGiverParsed[]>> = {}
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    let t: BadgeType | undefined
    if (/^\d+$/.test(key)) {
      const idx = Number.parseInt(key, 10)
      if (idx >= 0 && idx <= 6) t = idx as BadgeType
    } else {
      const enumIdx = CSHARP_BADGE_ENUM_NAMES.indexOf(
        key as (typeof CSHARP_BADGE_ENUM_NAMES)[number],
      )
      if (enumIdx >= 0) t = enumIdx as BadgeType
    }
    if (t === undefined || !Array.isArray(val)) continue
    const givers: BadgeGiverParsed[] = val.map((item) => {
      const g = item as Record<string, unknown>
      const uid = String(g.userId ?? g.UserId ?? "")
      return {
        userId: uid,
        username: String(g.username ?? g.Username ?? ""),
        avatar: (g.avatar ?? g.Avatar ?? null) as string | null,
      }
    })
    out[t] = givers
  }
  return out
}

/** Entry rozet özeti GET yanıtını frontend tipine normalize eder. */
export function normalizeEntryBadgeSummary(raw: Record<string, unknown>): {
  entryId: string
  totalsByType: Partial<Record<BadgeType, number>>
  totalBadges: number
  myBadges: BadgeType[]
  giversByType: Partial<Record<BadgeType, BadgeGiverParsed[]>>
} {
  const entryId = String(raw.entryId ?? raw.EntryId ?? "")
  const totalsByType = parseTotalsByType(raw.totalsByType ?? raw.TotalsByType)
  const tb =
    typeof raw.totalBadges === "number"
      ? raw.totalBadges
      : typeof raw.TotalBadges === "number"
        ? raw.TotalBadges
        : Object.values(totalsByType).reduce((a, b) => a + (b ?? 0), 0)
  const myRaw = (raw.myBadges ?? raw.MyBadges) as unknown
  const myBadges: BadgeType[] = Array.isArray(myRaw)
    ? myRaw.map((x) => Number(x) as BadgeType).filter((x) => x >= 0 && x <= 6)
    : []
  const giversByType = parseGiversByType(raw)

  return {
    entryId,
    totalsByType,
    totalBadges: tb,
    myBadges,
    giversByType,
  }
}

/** Profil GET /api/Badges/users/{id} yanıtını normalize eder. */
export interface UserBadgeGroupNormalized {
  badgeType: BadgeType
  count: number
  givers: BadgeGiverParsed[]
}

export interface UserBadgeCollectionNormalized {
  userId: string
  totalBadges: number
  groups: UserBadgeGroupNormalized[]
}

export function normalizeBadgeTypeKey(raw: unknown): BadgeType | null {
  if (typeof raw === "number" && raw >= 0 && raw <= 6 && Number.isInteger(raw)) {
    return raw as BadgeType
  }
  if (typeof raw === "string") {
    if (/^\d+$/.test(raw)) {
      const n = Number.parseInt(raw, 10)
      if (n >= 0 && n <= 6) return n as BadgeType
    }
    const idx = CSHARP_BADGE_ENUM_NAMES.indexOf(
      raw as (typeof CSHARP_BADGE_ENUM_NAMES)[number],
    )
    if (idx >= 0) return idx as BadgeType
  }
  return null
}

export function normalizeUserBadgeCollection(
  raw: Record<string, unknown>,
): UserBadgeCollectionNormalized {
  const userId = String(raw.userId ?? raw.UserId ?? "")
  const totalBadges =
    typeof raw.totalBadges === "number"
      ? raw.totalBadges
      : typeof raw.TotalBadges === "number"
        ? raw.TotalBadges
        : 0
  const groupsRaw = (raw.groups ?? raw.Groups) as unknown
  const groups: UserBadgeGroupNormalized[] = []
  if (Array.isArray(groupsRaw)) {
    for (const item of groupsRaw) {
      if (!item || typeof item !== "object") continue
      const g = item as Record<string, unknown>
      const badgeType = normalizeBadgeTypeKey(g.badgeType ?? g.BadgeType)
      if (badgeType === null) continue
      const count =
        typeof g.count === "number"
          ? g.count
          : typeof g.Count === "number"
            ? g.Count
            : 0
      const giversRaw = (g.givers ?? g.Givers) as unknown
      const givers: BadgeGiverParsed[] = []
      if (Array.isArray(giversRaw)) {
        for (const gv of giversRaw) {
          if (!gv || typeof gv !== "object") continue
          const gg = gv as Record<string, unknown>
          givers.push({
            userId: String(gg.userId ?? gg.UserId ?? ""),
            username: String(gg.username ?? gg.Username ?? ""),
            avatar: (gg.avatar ?? gg.Avatar ?? null) as string | null,
          })
        }
      }
      groups.push({ badgeType, count, givers })
    }
  }
  return { userId, totalBadges, groups }
}
