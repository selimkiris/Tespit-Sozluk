"use client"

import { cn } from "@/lib/utils"

type NoviceBadgeProps = {
  className?: string
  /** Profil üst bölümünde bir tık daha büyük metin. */
  variant?: "inline" | "profile"
}

/**
 * “Çömez” rozeti — muted, göz yormayan; açık/koyu modda slate tonları.
 * Yalnızca `isNovice` true iken (ve `shouldShowNoviceBadge` ile) gösterilmelidir.
 */
export function NoviceBadge({ className, variant = "inline" }: NoviceBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center self-center",
        "rounded-full font-medium leading-none tabular-nums tracking-wide",
        "border-0 shadow-none",
        "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400",
        variant === "profile"
          ? "px-2.5 py-1 text-xs"
          : "px-1.5 py-0.5 text-[10px]",
        className
      )}
      title="Çömez yazar"
    >
      Çömez
    </span>
  )
}

/** Backend `isNovice` + yazar rolü: Admin asla çömez sayılmaz; rozet buna göre. */
export function shouldShowNoviceBadge(isNovice: boolean | undefined, authorRole: string | undefined | null) {
  if (!isNovice) return false
  if (authorRole === "Admin") return false
  return true
}
