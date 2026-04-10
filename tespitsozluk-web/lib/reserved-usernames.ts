/**
 * Backend `ReservedUsernames` ile aynı mantık — güncellerken senkron tutun.
 *
 * a) tr-TR ile küçük harf
 * b) Türkçe harfleri Latin karşılıklarına
 * c) Harf/rakam dışı karakterleri kaldır
 */

const FORBIDDEN_SUBSTRINGS: readonly string[] = [
  "tespitsozluk",
  "admin",
  "yonetici",
  "moderator",
  "destek",
  "support",
  "anonim",
  "anonymous",
  "sistem",
  "system",
  "resmi",
  "official",
  "root",
  "staff",
  "webmaster",
]

const MOD_EXACT = "mod"

function mapTurkishLatin(c: string): string {
  if (c.length !== 1) return c
  switch (c) {
    case "ç":
      return "c"
    case "ğ":
      return "g"
    case "ı":
    case "i":
      return "i"
    case "ö":
      return "o"
    case "ş":
      return "s"
    case "ü":
      return "u"
    default:
      return c
  }
}

/** Kayıt / rezerve kontrolü için normalize (backend ile eşleşmeli). */
export function normalizeForReservedCheck(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ""

  let out = ""
  for (const ch of trimmed) {
    const lower = ch.toLocaleLowerCase("tr-TR")
    const mapped = mapTurkishLatin(lower)
    const code = mapped.codePointAt(0)!
    const isAsciiLetter = code >= 0x61 && code <= 0x7a
    const isDigit = code >= 0x30 && code <= 0x39
    if (isAsciiLetter || isDigit) out += mapped
  }

  return out
}

export function isReservedNickname(trimmed: string): boolean {
  const n = normalizeForReservedCheck(trimmed)
  if (!n) return false

  if (n === MOD_EXACT) return true

  for (const fragment of FORBIDDEN_SUBSTRINGS) {
    if (n.includes(fragment)) return true
  }

  return false
}
