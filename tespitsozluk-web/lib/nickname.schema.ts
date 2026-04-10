import { z } from "zod"
import { isReservedNickname } from "@/lib/reserved-usernames"

/** Kayıt ve ayarlar (nickname) için ortak kurallar */
export const nicknameFieldSchema = z
  .string()
  .trim()
  .min(3, "Mahlas en az 3 karakter olmalıdır.")
  .max(20, "Mahlas en fazla 20 karakter olabilir.")
  .regex(/^\S+$/, "Mahlas içinde boşluk bırakılamaz.")
  .refine((s) => !isReservedNickname(s), { message: "Bu isim kullanılamaz" })

export function validateNicknameTrimmed(trimmed: string): string | null {
  const r = nicknameFieldSchema.safeParse(trimmed)
  if (!r.success) return r.error.issues[0]?.message ?? "Geçersiz mahlas."
  return null
}
