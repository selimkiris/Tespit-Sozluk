/** Sunucu ve istemcide aynı çıktıyı vermek için sabit TZ (hydration uyumu). */
export const TURKEY_TIMEZONE = "Europe/Istanbul"

export function formatTurkeyDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: TURKEY_TIMEZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function formatTurkeyDateOnly(raw: string): string | null {
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: TURKEY_TIMEZONE,
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d)
  } catch {
    return null
  }
}
